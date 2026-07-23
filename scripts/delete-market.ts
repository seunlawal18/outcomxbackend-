import db from '../src/db/client';

const id = Number(process.argv[2]);
if (!id) { console.error('Usage: tsx scripts/delete-market.ts <id>'); process.exit(1); }

db.prepare('DELETE FROM markets WHERE id = ?').run(id).then(r => {
  console.log(`Deleted ${r.changes} market(s) with id ${id}.`);
  process.exit(0);
}).catch(err => { console.error(err); process.exit(1); });
