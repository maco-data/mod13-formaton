#!/usr/bin/env node

const [apiUrl, edgeUrl] = process.argv.slice(2);

if (!apiUrl || !edgeUrl) {
  console.error('Uso: node verify-smoke-response.js <api-url> <edge-url>');
  process.exit(1);
}

async function fetchAndValidate(url, label) {
  const response = await fetch(url, {
    headers: {
      accept: 'application/json',
    },
  });

  const rawBody = await response.text();
  let body;

  try {
    body = JSON.parse(rawBody);
  } catch {
    throw new Error(`${label}: la respuesta no es JSON válido`);
  }

  if (!response.ok) {
    throw new Error(`${label}: HTTP ${response.status} con body ${rawBody}`);
  }

  if (!Array.isArray(body.items)) {
    throw new Error(`${label}: "items" no es un array`);
  }

  if (typeof body.count !== 'number') {
    throw new Error(`${label}: "count" no es numérico`);
  }

  if (body.count !== body.items.length) {
    throw new Error(`${label}: "count" (${body.count}) no coincide con items.length (${body.items.length})`);
  }

  for (const [index, item] of body.items.entries()) {
    if (typeof item !== 'object' || item === null) {
      throw new Error(`${label}: item[${index}] no es un objeto`);
    }

    for (const key of ['id', 'name', 'status']) {
      if (typeof item[key] !== 'string' || item[key].length === 0) {
        throw new Error(`${label}: item[${index}] no tiene "${key}" válido`);
      }
    }
  }

  return body;
}

async function main() {
  const [apiBody, edgeBody] = await Promise.all([
    fetchAndValidate(apiUrl, 'api'),
    fetchAndValidate(edgeUrl, 'edge'),
  ]);

  if (apiBody.count !== edgeBody.count) {
    throw new Error(`La API y CloudFront no devuelven el mismo count (${apiBody.count} vs ${edgeBody.count})`);
  }

  const apiIds = apiBody.items.map(item => item.id).join(',');
  const edgeIds = edgeBody.items.map(item => item.id).join(',');

  if (apiIds !== edgeIds) {
    throw new Error('La API y CloudFront devuelven listas distintas para el smoke test');
  }

  console.log(`Smoke verificado. count=${apiBody.count}`);
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
