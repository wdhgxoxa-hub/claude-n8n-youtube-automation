"""Cierra los cortes de datos demostrados por el ensayo local; no ejecuta servicios."""
# El retorno escribe estado «listo». La proyección compartida también admite el
# estado histórico «ok», y nunca muestra trabajos enviados/fallidos.
# El siguiente guion recibe solo aprendizajes terminados de su propio canal.
f = reabrir(ORQ)
lista_cooper(f, 'Aprendizaje del canal', 'trabajos', [
    {'keyName': 'canal_id', 'condition': 'eq', 'keyValue': "={{ $('Buscar canal').first().json.canal_id }}"},
    {'keyName': 'modo', 'condition': 'eq', 'keyValue': 'aprender'},
])
antes(f, 'Temas recientes del canal', 'Aprendizaje del canal', 'Aprendizaje del canal')
n = next(n for n in f.nodes if n['name'] == 'Nuevo video')
n['parameters']['jsCode'] = OBS_JS + n['parameters']['jsCode']
cambiar(ORQ, 'Nuevo video', "nicho: canal.nicho || '', formato, biblia,", """
nicho: canal.nicho || '', formato, biblia,
    aprendizaje: leccionesCooper(canal, $('Aprendizaje del canal').all().map(i => i.json)).slice(-12),
    aprendizaje_instrucciones: 'Usa las lecciones como contexto del guion, respetando la biblia y las fuentes. No conviertas una observación aislada en regla ni cambies la biblia automáticamente; las propuestas requieren evidencia repetida en al menos tres videos.',
""")

# El analista necesita el texto y el plano, no solo una curva sin contexto.
# Se reutilizan trabajos ya terminados; el cruce vuelve a comprobar canal/video.
f = reabrir(APRENDE)
lista_cooper(f, 'Guiones y storyboards de aprendizaje', 'trabajos')
antes(f, 'Publicaciones', 'Guiones y storyboards de aprendizaje', 'Guiones y storyboards de aprendizaje')
n = next(n for n in f.nodes if n['name'] == 'Pedir lecciones')
contexto = r"""
const trabajosAprendizaje = $('Guiones y storyboards de aprendizaje').all().map(i => i.json);
function contextoAprendizaje(video) {
  const propios = trabajosAprendizaje.filter(t => t.video_id === video.video_id && t.canal_id === video.canal_id && ['listo','ok'].includes(t.estado))
    .sort((a,b) => String(a.updatedAt || a.createdAt || '').localeCompare(String(b.updatedAt || b.createdAt || '')) || Number(a.id || 0) - Number(b.id || 0));
  const ultimo = modos => {
    for (const t of [...propios].reverse()) {
      if (!modos.includes(t.modo)) continue;
      try { const r = JSON.parse(t.resultado || '{}').resultado; if (r && typeof r === 'object' && !Array.isArray(r)) return r; } catch {}
    }
    return {};
  };
  const guion = ultimo(['guion','corregir_guion']), storyboard = ultimo(['storyboard']);
  const shotlist = (Array.isArray(storyboard.planos) ? storyboard.planos : []).filter(p => p && typeof p === 'object' && !Array.isArray(p)).slice(0,200).map(p => ({
    id: String(p.id || ''), tipo: String(p.tipo || ''), texto_narrado: String(p.texto_narrado || '').slice(0,2000),
    texto_pantalla: String(p.texto_pantalla || '').slice(0,500), emocion: String(p.emocion || '').slice(0,100),
  }));
  return { guion: { titulo: String(guion.titulo || '').slice(0,500), texto: String(guion.guion || '').slice(0,30000),
    ganchos: (Array.isArray(guion.ganchos) ? guion.ganchos : []).slice(0,5), gancho_elegido: guion.gancho_elegido ?? null },
    shotlist, contexto_incompleto: !guion.guion || !shotlist.length,
    tiempos_planos_disponibles: false };
}
"""
n['parameters']['jsCode'] = contexto + n['parameters']['jsCode']
cambiar(APRENDE, 'Pedir lecciones', "dias: v.dias, retencion:", "dias: v.dias, ...contextoAprendizaje(v), retencion:")
cambiar(APRENDE, 'Pedir lecciones', "plataformas: p.plataformas, dias: p.dias,", "plataformas: p.plataformas, dias: p.dias, ...contextoAprendizaje(p),")
