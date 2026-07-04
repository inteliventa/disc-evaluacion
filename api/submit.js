const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const { email, scores, norm, perfil_predominante, perfil_complementario, titulo, traits } = req.body;

  if (!email || !scores) {
    return res.status(400).json({ error: 'Datos incompletos' });
  }

  // Verificar que el candidato existe
  const findRes = await fetch(
    `${SUPABASE_URL}/rest/v1/candidatos?email=eq.${encodeURIComponent(email)}&select=id,nombre`,
    {
      headers: {
        Authorization: `Bearer ${SUPABASE_KEY}`,
        apikey: SUPABASE_KEY,
      },
    }
  );

  const candidatos = await findRes.json();

  if (!Array.isArray(candidatos) || candidatos.length === 0) {
    return res.status(404).json({
      error: 'no_encontrado',
      message: 'El correo ingresado no está registrado en ningún proceso activo.',
    });
  }

  // Guardar resultado DISC en el candidato
  const informe = {
    titulo,
    perfil_predominante,
    perfil_complementario,
    scores,
    norm,
    traits,
    completado_en: new Date().toISOString(),
  };

  const updateRes = await fetch(
    `${SUPABASE_URL}/rest/v1/candidatos?email=eq.${encodeURIComponent(email)}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${SUPABASE_KEY}`,
        apikey: SUPABASE_KEY,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        disc_informe: informe,
        disc_fecha: new Date().toISOString(),
        tiene_disc: true,
      }),
    }
  );

  if (!updateRes.ok) {
    const err = await updateRes.text();
    console.error('Supabase update error:', err);
    return res.status(500).json({ error: 'Error al guardar el resultado' });
  }

  return res.status(200).json({
    ok: true,
    nombre: candidatos[0].nombre,
  });
}
