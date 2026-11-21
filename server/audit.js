// Historial de cambios para trazabilidad
export async function audit(db, { entidad, entidadId = null, obraId = null, accion, detalle = '', datos = null, usuarioId = null }) {
  await db.query(
    `INSERT INTO historial (entidad, entidad_id, obra_id, accion, detalle, datos, usuario_id) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [entidad, entidadId, obraId, accion, detalle, datos ? JSON.stringify(datos) : null, usuarioId]
  );
}
