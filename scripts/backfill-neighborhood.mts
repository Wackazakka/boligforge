import { readFileSync } from 'fs'
for (const line of readFileSync('/Users/larskilevold_1/boligforge/.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}
const { serviceClient } = await import('../lib/avatar/rag')
const { fetchNeighborhoodFacts } = await import('../lib/avatar/neighborhood')
const client = serviceClient()
const { data: props } = await client.from('properties').select('id, address').not('address', 'is', null).is('neighborhood_facts', null)
console.log(`${props?.length ?? 0} eiendommer å backfille`)
for (const p of props ?? []) {
  if (!p.address || p.address.startsWith('⏳')) continue
  const facts = await fetchNeighborhoodFacts(p.address)
  if (facts) {
    await client.from('properties').update({ neighborhood_facts: facts }).eq('id', p.id)
    console.log(`✅ ${p.address}\n${facts.split('\n').map(l => '   ' + l).join('\n')}`)
  } else {
    console.log(`— ${p.address}: ingen treff`)
  }
  await new Promise(r => setTimeout(r, 300))
}
