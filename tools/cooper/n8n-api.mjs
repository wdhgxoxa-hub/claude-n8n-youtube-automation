// Contrato oficial empaquetado con n8n 2.47.4: public-api/v1/openapi.yml.
export class N8nApi {
  constructor(url, key) {
    this.url = url.replace(/\/$/, "");
    this.key = key;
  }
  async request(method, path, body) {
    const response = await fetch(`${this.url}/api/v1${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-N8N-API-KEY": this.key,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: "error",
      signal: AbortSignal.timeout(30000),
    });
    // No registrar cabeceras, cuerpos ni respuestas con credenciales.
    if (!response.ok) {
      const error = new Error(
        `n8n ${method} ${path.split("?")[0]}: HTTP ${response.status}`,
      );
      // Disponible al llamador de ensayo; la CLI de migración solo imprime message.
      error.detail = await response.text();
      throw error;
    }
    return response.status === 204 ? null : response.json();
  }
  async all(path) {
    const rows = [];
    let cursor;
    do {
      const page = await this.request(
        "GET",
        `${path}?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
      );
      rows.push(...page.data);
      cursor = page.nextCursor;
    } while (cursor);
    return rows;
  }
  rows(id) {
    return this.all(`/data-tables/${id}/rows`);
  }
  update(id, row, data) {
    return this.request("PATCH", `/data-tables/${id}/rows/update`, {
      filter: {
        type: "and",
        filters: [{ columnName: "id", condition: "eq", value: row.id }],
      },
      data,
      returnData: true,
    });
  }
}
