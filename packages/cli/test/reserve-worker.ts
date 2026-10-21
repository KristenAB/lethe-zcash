// One wallet process reserving one refund index. Several of these run at once in book-race.test.ts.
//   tsx reserve-worker.ts <seed> <book> <startAtMs>
import { IndexBook } from '../src/lib.js';

const [seed, book, startAt] = process.argv.slice(2);
while (Date.now() < Number(startAt)); // line up with the other processes
const { r } = new IndexBook(book).reserve(seed);
console.log(JSON.stringify({ index: r.index, refundTo: r.refundTo }));
