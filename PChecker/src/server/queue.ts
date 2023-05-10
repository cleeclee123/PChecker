const transactionStatus = (seconds: number, id: string) =>
  new Promise((resolve, reject) => {
    if (seconds > 25) {
      reject(new Error("Request timed out"));
    }
    setTimeout(() => {
      resolve(`Your transaction is successful, ${id}`);
    }, seconds * 1000);
  });

const tasks = [
  transactionStatus(5, "A"),
  transactionStatus(2, "B"),
  transactionStatus(2, "C"),
  transactionStatus(4, "D"),
  transactionStatus(6, "E"),
  transactionStatus(9, "F"),
  transactionStatus(2, "G"),
  transactionStatus(4, "H"),
  transactionStatus(6, "I"),
];

class ConcurrentPromiseQueue {
  private todo: any;
  private running: any[];
  private complete: any[];
  private count: number;

  constructor(tasks: any[] = [], concurrentCount: number = 1) {
    this.todo = tasks;
    this.running = [];
    this.complete = [];
    this.count = concurrentCount;
  }

  private runNext(): boolean {
    return this.running.length < this.count && this.todo.length > 0;
  }

  public run(): void {
    while (this.runNext()) {
      const promise = this.todo.shift();
      promise
        .then((data: any) => {
          console.log(data);
          this.complete.push(this.running.shift());
          this.run();
        })
        .catch((error: any) => {
          console.error("Error in PromiseQueue:", error);
        });
      this.running.push(promise);
    }
  }
}

const taskQueue = new ConcurrentPromiseQueue(tasks, 5);
taskQueue.run();
