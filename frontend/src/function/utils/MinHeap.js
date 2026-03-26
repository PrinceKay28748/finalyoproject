// utils/MinHeap.js
// Binary min-heap used as a priority queue in Dijkstra's algorithm
// Replaces the O(n) linear scan with O(log n) insert and extract
// This is the standard optimization for Dijkstra on large graphs

export class MinHeap {
  constructor() {
    this.heap = []; // array-based binary heap
  }

  // Returns number of elements in the heap
  get size() {
    return this.heap.length;
  }

  // Inserts a new node with a given priority (distance)
  push(nodeId, priority) {
    this.heap.push({ nodeId, priority });
    this._bubbleUp(this.heap.length - 1);
  }

  // Removes and returns the node with the lowest priority
  pop() {
    const top  = this.heap[0];
    const last = this.heap.pop();

    if (this.heap.length > 0) {
      this.heap[0] = last;
      this._sinkDown(0);
    }

    return top;
  }

  // Moves a newly inserted element up until heap property is restored
  _bubbleUp(i) {
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      if (this.heap[parent].priority <= this.heap[i].priority) break;
      [this.heap[parent], this.heap[i]] = [this.heap[i], this.heap[parent]];
      i = parent;
    }
  }

  // Moves an element down until heap property is restored
  _sinkDown(i) {
    const n = this.heap.length;
    while (true) {
      let smallest = i;
      const left   = 2 * i + 1;
      const right  = 2 * i + 2;

      if (left  < n && this.heap[left].priority  < this.heap[smallest].priority) smallest = left;
      if (right < n && this.heap[right].priority < this.heap[smallest].priority) smallest = right;

      if (smallest === i) break;

      [this.heap[smallest], this.heap[i]] = [this.heap[i], this.heap[smallest]];
      i = smallest;
    }
  }
}