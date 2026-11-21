// El túnel SSH une sockets privados. Cada extremo conserva su propio token.
import { createServer, request } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { chmod, lstat, unlink } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const LIMITE = 256 * 1024;
export function crearRele({ modo, token, socket, puertoDestino = 8789, timeout = 47000 }) {
  if (!['pc', 'vps'].includes(modo) || typeof token !== 'string' || token.length < 32)
    throw new Error('Configuración de relé inválida');
  if (modo === 'vps' && (!socket || !socket.startsWith('/')))
    throw new Error('Falta socket privado');
  const server = createServer(async (req, res) => {
    const reply = (status, error) => {
      if (!res.destroyed && !res.writableEnded) {
        res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
        res.end(JSON.stringify({ error }));
      }
    };
    if (req.headers.origin) { req.resume(); return reply(401, 'no_autorizado'); }
    if (modo === 'vps') {
      const esperado = Buffer.from(`Bearer ${token}`), recibido = Buffer.from(req.headers.authorization || '');
      if (esperado.length !== recibido.length || !timingSafeEqual(esperado, recibido)) {
        req.resume(); return reply(401, 'no_autorizado');
      }
    }
    const salud = req.method === 'GET' && req.url === '/salud';
    if (!salud && !(req.method === 'POST' && ['/v1/chat', '/v1/texto'].includes(req.url))) {
      req.resume(); return reply(404, 'ruta_invalida');
    }
    if (!salud && req.headers['content-type']?.split(';')[0] !== 'application/json') {
      req.resume(); return reply(415, 'tipo_invalido');
    }
    let bytes = 0;
    const chunks = [];
    try {
      for await (const chunk of req) {
        bytes += chunk.length;
        if (bytes > LIMITE) return reply(413, 'cuerpo_excesivo');
        chunks.push(chunk);
      }
    } catch { return reply(400, 'pedido_incompleto'); }
    const upstream = request({
      ...(modo === 'pc' ? { hostname: '127.0.0.1', port: puertoDestino } : { socketPath: socket }),
      path: req.url, method: req.method, agent: false,
      headers: { 'content-type': 'application/json', 'content-length': bytes,
        // El token del VPS nunca atraviesa SSH; el de PC nunca sale de loopback.
        ...(modo === 'pc' ? { authorization: `Bearer ${token}` } : {}) },
    }, (response) => {
      let size = 0;
      const result = [];
      response.on('data', (chunk) => {
        size += chunk.length;
        if (size > 2 * 1024 * 1024) upstream.destroy(new Error('limite'));
        else result.push(chunk);
      });
      response.on('error', () => reply(502, 'puente_no_disponible'));
      response.on('end', () => {
        if (res.destroyed || res.writableEnded) return;
        const status = response.statusCode || 502;
        if (status >= 300 && status < 400) return reply(502, 'respuesta_invalida');
        res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
        res.end(Buffer.concat(result));
      });
    });
    const timer = setTimeout(() => upstream.destroy(new Error('tiempo')), timeout);
    upstream.on('close', () => clearTimeout(timer));
    upstream.on('error', () => reply(503, 'puente_no_disponible'));
    res.on('close', () => { if (!res.writableEnded) upstream.destroy(); });
    upstream.end(Buffer.concat(chunks));
  });
  server.requestTimeout = 10000;
  server.headersTimeout = 5000;
  return server;
}

export async function escucharPrivado(server, socket) {
  const parent = await lstat(dirname(socket));
  if (!parent.isDirectory() || parent.isSymbolicLink() || (parent.mode & 0o077) || parent.uid !== process.getuid())
    throw new Error('El directorio del socket requiere dueño actual y modo 0700');
  try {
    const previous = await lstat(socket);
    if (!previous.isSocket() || previous.uid !== process.getuid()) throw new Error('Ruta ocupada');
    // systemd garantiza una instancia; solo elimina el socket privado abandonado.
    await unlink(socket);
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  await new Promise((yes, no) => { server.once('error', no); server.listen(socket, yes); });
  await chmod(socket, 0o600);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const modo = process.env.COOPER_RELE_MODO;
  const server = crearRele({ modo, token: process.env.PUENTE_CODEX_TOKEN, socket: process.env.COOPER_RELE_SOCKET });
  if (modo === 'pc') await escucharPrivado(server, process.env.COOPER_RELE_SOCKET);
  else server.listen(8789, '127.0.0.1');
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { server.close(); server.closeAllConnections(); });
}
