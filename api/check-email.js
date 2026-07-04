const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email requerido' });

  // Verificar si ya completó el test
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/candidatos?email=eq.${encodeURIComponent(email)}&select=id,nombre,tiene_disc`,
    { headers: { Authorization: `Bearer ${SUPABASE_KEY}`, apikey: SUPABASE_KEY } }
  );

  const rows = await r.json();

  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(404).json({ error: 'no_encontrado' });
  }

  if (rows[0].tiene_disc) {
    return res.status(409).json({ error: 'ya_completado', nombre: rows[0].nombre });
  }

  return res.status(200).json({ ok: true, nombre: rows[0].nombre });
}
