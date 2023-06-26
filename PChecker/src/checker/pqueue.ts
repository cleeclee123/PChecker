import { v4 as uuid } from "uuid";
import { createLogger, transports, format, Logger } from "winston";

export type PromiseSupplier<T> = () => Promise<T>;
type PromiseExecutionListener<T> = (result: FinishedPromiseResult<T>) => void;

interface FinishedPromiseResult<T> {
  isSuccess: boolean;
  result: T | null;
  error: unknown;
}

interface QueuedPromise<T> {
  id: string;
  promiseSupplier: PromiseSupplier<T>;
}

export interface QueueOptions {
  maxNumberOfConcurrentPromises?: number;
  unitOfTimeMillis?: number;
  maxThroughputPerUnitTime?: number;
}

export class MyConcurrentPromiseQueue<T> {
  private readonly maxNumberOfConcurrentPromises: number;
  private readonly unitOfTimeMillis: number;
  private readonly maxThroughputPerUnitTime: number;
  private promisesToExecute: Array<QueuedPromise<T>> = [];
  private promisesBeingExecuted = new Map<string, QueuedPromise<T>>();
  private promiseExecutedCallbacks = new Map<
    string,
    PromiseExecutionListener<T>
  >();
  private promiseCompletedTimesLog: Date[] = [];
  protected logger_: Logger;

  constructor(options?: QueueOptions, putToKVStore?: (result: any) => any) {
    const defaultOptions = {
      maxNumberOfConcurrentPromises: 1,
      unitOfTimeMillis: 100,
      maxThroughputPerUnitTime: 1000,
    } as const;

    const finalOptions = { ...defaultOptions, ...options };

    this.maxNumberOfConcurrentPromises =
      finalOptions.maxNumberOfConcurrentPromises;
    this.unitOfTimeMillis = finalOptions.unitOfTimeMillis;
    this.maxThroughputPerUnitTime = finalOptions.maxThroughputPerUnitTime;

    this.logger_ = createLogger({
      transports: [new transports.Console()],
      format: format.combine(
        format.colorize(),
        format.timestamp(),
        format.printf(({ timestamp, level, message }) => {
          return `[${timestamp}] ${level}: ${message}`;
        })
      ),
    });
  }

  public numberOfQueuedPromises(): number {
    return this.promisesToExecute.length;
  }

  public numberOfExecutingPromises(): number {
    return this.promisesBeingExecuted.size;
  }

  public addPromise(promiseSupplier: PromiseSupplier<T>): Promise<T | null> {
    const promiseResult: Promise<T | null> = new Promise((resolve, reject) => {
      const id = uuid();
      this.promisesToExecute.push({ id, promiseSupplier });
      this.promiseExecutedCallbacks.set(
        id,
        ({ isSuccess, result, error }: FinishedPromiseResult<T>) => {
          isSuccess ? resolve(result) : reject(error);
        }
      );
      this.execute();
    });
    return promiseResult;
  }

  private execute(): void {
    try {
      while (this.canExecuteMorePromises()) {
        const promise = this.promisesToExecute.shift();
        if (!promise) return;
        this.promisesBeingExecuted.set(promise.id, promise);
        promise
          .promiseSupplier()
          .then(async (result) => {
            this.onPromiseFulfilled(promise.id, result);
            this.logger_.info(
              `${promise.id} success => ${JSON.stringify(result)}`
            );
          })
          .catch((error) => {
            this.onPromiseRejected(promise.id, error);
            this.logger_.error(`${promise.id} error, ${error}`);
          });
      }
    } catch (error) {
      this.logger_.error(`execute error, ${error}`);
    }
  }

  private canExecuteMorePromises(): boolean {
    const now = Date.now();
    const timeThreshold = now - this.unitOfTimeMillis;
    this.promiseCompletedTimesLog = this.promiseCompletedTimesLog.filter(
      (time) => time.getTime() >= timeThreshold
    );
    return (
      this.promisesBeingExecuted.size < this.maxNumberOfConcurrentPromises &&
      this.promiseCompletedTimesLog.length < this.maxThroughputPerUnitTime
    );
  }

  private onPromiseFulfilled(id: string, result: T): void {
    const callback = this.promiseExecutedCallbacks.get(id);
    if (callback) {
      callback({ isSuccess: true, result, error: null });
    }
    this.finalizePromise(id);
  }

  private onPromiseRejected(id: string, error: unknown): void {
    const callback = this.promiseExecutedCallbacks.get(id);
    if (callback) {
      callback({ isSuccess: false, result: null, error });
    }
    this.finalizePromise(id);
  }

  private finalizePromise(id: string): void {
    this.promisesBeingExecuted.delete(id);
    this.promiseExecutedCallbacks.delete(id);
    this.promiseCompletedTimesLog.push(new Date(Date.now()));
    this.execute();
  }

  public turnOffLogger(): void {
    this.logger_.transports.forEach((t) => (t.silent = true));
  }
}
