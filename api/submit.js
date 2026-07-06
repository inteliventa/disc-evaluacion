const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const { email, scores, norm, perfil_predominante, perfil_complementario, titulo, traits, duracion_total_seg, tiempos_por_pregunta } = req.body;

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

  // Generar interpretación narrativa con Claude
  let interpretacion = null;
  try {
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        messages: [{
          role: 'user',
          content: `Eres un experto en perfiles conductuales DISC. Redacta una interpretación narrativa breve (3-4 párrafos) para la siguiente evaluación. Escribe en español, en tercera persona, sin mencionar cargos específicos. Enfócate en: cómo se comporta esta persona, cómo se comunica, cómo toma decisiones, cómo reacciona bajo presión, y cuáles son sus fortalezas y limitaciones naturales.

Perfil predominante: ${perfil_predominante} — ${titulo}
Perfil complementario: ${perfil_complementario}
Puntajes normalizados: D=${norm.D} I=${norm.I} S=${norm.S} C=${norm.C}
Rasgos: ${traits.join(', ')}
Duración del test: ${duracion_total_seg} segundos

Responde SOLO con el texto de la interpretación, sin títulos ni viñetas.`,
        }],
      }),
    });
    const claudeData = await claudeRes.json();
    interpretacion = claudeData.content?.[0]?.text ?? null;
  } catch (e) {
    console.error('Error generando interpretación Claude:', e.message);
  }

  // Guardar resultado DISC en el candidato
  const informe = {
    titulo,
    perfil_predominante,
    perfil_complementario,
    scores,
    norm,
    traits,
    interpretacion,
    duracion_total_seg,
    tiempos_por_pregunta,
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
