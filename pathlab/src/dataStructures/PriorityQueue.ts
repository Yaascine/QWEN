/** Binary min-heap priority queue. O(log n) push/pop, no re-sorting. */
export interface PQItem<P> {
  priority: P;
  value: number; // encoded node index
}

export class PriorityQueue<P> {
  private heap: PQItem<P>[] = [];
  constructor(private lessThan: (a: P, b: P) => boolean) {}

  get size(): number {
    return this.heap.length;
  }

  isEmpty(): boolean {
    return this.heap.length === 0;
  }

  peek(): PQItem<P> | undefined {
    return this.heap[0];
  }

  enqueue(value: number, priority: P): void {
    this.heap.push({ value, priority });
    this.bubbleUp(this.heap.length - 1);
  }

  dequeue(): PQItem<P> | undefined {
    const n = this.heap.length;
    if (n === 0) return undefined;
    const top = this.heap[0];
    const last = this.heap.pop()!;
    if (n > 1) {
      this.heap[0] = last;
      this.sinkDown(0);
    }
    return top;
  }

  /** Snapshot of up to `limit` lowest-priority items for the UI viewer. */
  snapshot(limit: number): PQItem<P>[] {
    const copy = this.heap.slice();
    copy.sort((a, b) => (this.lessThan(a.priority, b.priority) ? -1 : this.lessThan(b.priority, a.priority) ? 1 : 0));
    return copy.slice(0, limit);
  }

  private bubbleUp(i: number): void {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.lessThan(this.heap[i].priority, this.heap[parent].priority)) {
        [this.heap[i], this.heap[parent]] = [this.heap[parent], this.heap[i]];
        i = parent;
      } else break;
    }
  }

  private sinkDown(i: number): void {
    const n = this.heap.length;
    for (;;) {
      let smallest = i;
      const l = 2 * i + 1;
      const r = 2 * i + 2;
      if (l < n && this.lessThan(this.heap[l].priority, this.heap[smallest].priority)) smallest = l;
      if (r < n && this.lessThan(this.heap[r].priority, this.heap[smallest].priority)) smallest = r;
      if (smallest === i) break;
      [this.heap[i], this.heap[smallest]] = [this.heap[smallest], this.heap[i]];
      i = smallest;
    }
  }
}
