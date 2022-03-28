type DataTypeBase = AnyObj;

type UpdateCallback<D extends DataTypeBase> = (newAttr: Partial<D>) => any;
type CallbackWithOpts<D> = {
  id: string;
  callback: UpdateCallback<D>;
  onlyTheseKeys: (keyof D)[];
};

type RegisterUpdateCallbackOpts<D extends DataTypeBase> = {
  callback: UpdateCallback<D>;
  callbackId?: string;
  overwriteExistingCallback?: boolean;
  onlyTheseKeys?: (keyof D)[];
};

type StreamConstructorOpts<DataType extends DataTypeBase> = {
  defaultState?: DataType;
  showStreamDataUpdateDebug?: boolean;
};

export class Stream<DataType extends DataTypeBase> {
  showStreamDataUpdateDebug: boolean;
  data: DataType | null;
  updateCallbacks: CallbackWithOpts<DataType>[] = [];

  constructor({
    defaultState,
    showStreamDataUpdateDebug = false,
  }: StreamConstructorOpts<DataType> = {}) {
    this.showStreamDataUpdateDebug = showStreamDataUpdateDebug;
    this.data = defaultState || null;
    this.updateCallbacks = [];
  }

  init(initData: DataType, force = false) {
    if (!this.data || force) this.data = initData;
  }

  /**
   * @param callbackId Optionally provide a unique string ID to ensure the same callback is not added multiple times.
   * @param overwriteExistingCallback If ID provided, by default existing callback w/ that ID will be overwritten. If set to false, first callback set will remain.
   * @param onlyTheseKeys Only call the callback if the provided keys of DataType are updated
   * Returns the callback ID
   */
  registerUpdateCallback({
    callback,
    callbackId,
    overwriteExistingCallback = true,
    onlyTheseKeys = [],
  }: RegisterUpdateCallbackOpts<DataType>) {
    const parsedCallbackId = callbackId || UUID.string();
    const callbackIdAlreadyRegistered = this.updateCallbacks.some(
      ({ id }) => id === callbackId
    );
    const overwriteDisallowed =
      callbackIdAlreadyRegistered && !overwriteExistingCallback;

    if (!overwriteDisallowed)
      this.updateCallbacks = this.updateCallbacks
        .filter(({ id }) => id !== parsedCallbackId)
        .concat({ callback, id: parsedCallbackId, onlyTheseKeys });
    return parsedCallbackId;
  }

  unregisterUpdateCallback(callbackId: string) {
    this.updateCallbacks = this.updateCallbacks.filter(
      ({ id }) => id !== callbackId
    );
  }

  /** Run with singleValObj if only updating one value */
  private async runCallbacks(singleValObj: AnyObj | null = null) {
    const key = singleValObj && Object.keys(singleValObj)[0];
    this.updateCallbacks.forEach(({ callback, id, onlyTheseKeys }) => {
      const isNotWatchedKey =
        onlyTheseKeys.length && (!key || (key && !onlyTheseKeys.includes(key)));
      if (isNotWatchedKey) return;
      if (this.showStreamDataUpdateDebug)
        console.log(`Running stream update callback with ID "${id}"`);
      callback((singleValObj || this.data) as unknown as Partial<DataType>);
    });
  }

  /** Set stream data. This is the only way to trigger an update callback when
   * setting the entire object */
  async setData(data: DataType, { suppressChangeTrigger = false } = {}) {
    if (!this.isInitialized) this.init(data);
    else this.data = data;
    if (!suppressChangeTrigger) await this.runCallbacks();
  }

  async updateAttr<K extends keyof DataType>(key: K, val: DataType[K]) {
    if (!this.data)
      throw new Error(
        `Attempting to set stream attribute ${key} before initializing stream.`
      );
    this.data[key] = val;
    await this.runCallbacks({ [key]: val });
  }

  /** Used to trigger callbacks when no change has occurred */
  triggerChange() {
    return this.runCallbacks();
  }

  getData() {
    if (!this.data)
      throw new Error(
        'Attempting to get stream data before initializing stream.'
      );
    return this.data;
  }

  clearData() {
    // @ts-ignore
    delete this.data;
    this.data = null;
    this.runCallbacks();
  }

  get isInitialized() {
    return Boolean(this.data);
  }
}

export type StreamDataType<S> = S extends Stream<infer D> ? D : never;

/**
 * Subscribe a stream to another stream.
 *
 * The 2 streams involved:
 *  - dependent$: the stream that subscribes to changes in another stream.
 *  - source$: the stream whose changes trigger updates in dependent$
 *
 * The stateReducer function takes the latest state of both streams and
 * reduces it into dependent$ state. This allows dependent$ to incorporate
 * changes from the source$ into its own state.
 *
 * If stateReducer returns null, the dependent$ state will not be updated.
 * This provides a mechanism for dependent$ to decide whether or not to update
 * based on the changes in source$.
 *
 * This action is triggered whenever a change occurs in source$
 *
 * If no stateReducer argument passed, don't change state on reload.
 */
// ts-unused-exports:disable-next-line
export const subscribe = <
  DependentState extends DataTypeBase,
  SourceState extends DataTypeBase
>(
  subscriptionName: string,
  dependent$: Stream<DependentState>,
  source$: Stream<SourceState>,
  stateReducer: (
    latestDependentState: DependentState,
    latestSourceState: SourceState
  ) => DependentState | null = state => state
) => {
  source$.registerUpdateCallback({
    callbackId: subscriptionName,
    callback: async () => {
      const latestDependentData = dependent$.getData();
      const latestSourceData = source$.getData();
      const reducedData = stateReducer(latestDependentData, latestSourceData);
      // If the reducer returns null, no update should occur
      if (reducedData) await dependent$.setData(reducedData);
    },
  });
};

type CombineStreams = <StreamDict extends Record<string, Stream<any>>>(
  streamDict: StreamDict
) => Stream<{ [key in keyof StreamDict]: StreamDataType<StreamDict[key]> }>;
/**
 * Create a new stream that combines the data of multiple streams. Combined
 * stream state data is namespaced as per the streamDict passed in.
 *
 * The streams must be initialized at the time of combining, or this will fail.
 *
 * The returned stream will update whwnever its combined streams do.
 */
export const combineStreams: CombineStreams = streamDict => {
  const defaultState = Object.entries(streamDict).reduce(
    (accState, [namespace, $]) => ({ ...accState, [namespace]: $.getData() }),
    {} as any
  );
  const combined$ = new Stream({ defaultState });
  Object.entries(streamDict).forEach(([namespace, $]) =>
    $.registerUpdateCallback({
      callback: () => {
        const latestCombinedState = combined$.getData();
        const latestSourceState = $.getData();
        combined$.setData({
          ...latestCombinedState,
          [namespace]: latestSourceState,
        });
      },
    })
  );
  return combined$;
};