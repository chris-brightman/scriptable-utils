import { composeIdentities } from '../flow';
import persisted from '../io/persisted';
import ThrottledBatchQueue from '../ThrottledBatchQueue';
import { LightDarkKey, SFSymbolKey, TintRequestKey } from './types';
import { getTintRequestKey } from './utils';

/** The persisted data is indexed by script name (from `Script.name()`) and
 * light/dark mode. Each of these permutations will have an array of
 * `TintRequestKey`s that should be preloaded for that script. */
type Data = Record<string, Record<LightDarkKey, TintRequestKey[]>>;

type Reducer = Identity<Data>;

type Path = { script: string; mode: LightDarkKey };

//

const io = persisted<Data>({
  defaultData: {},
  filename: 'sfSymbolPreloadList',
});

const getDataPath = (): Path => ({
  script: Script.name(),
  mode: Device.isUsingDarkAppearance() ? 'dark' : 'light',
});

/** NB: Order is preserved -- ideally this means that the icons that are loaded
 * immediately in the view are at the beginning of the list. The goal then is to
 * load those first when preloading -- if the design changes much, probably wise
 * to delete the persisted file and rebuild. */
const getAddKeyReducer = (key: TintRequestKey): Reducer => {
  const { script, mode } = getDataPath();
  return currData => {
    currData[script] = {
      light: currData[script]?.light ?? [],
      dark: currData[script]?.dark ?? [],
    };
    const currKeys = currData[script]![mode]!;
    if (!currKeys.includes(key)) currData[script]![mode]!.push(key);
    return currData;
  };
};

const removeExistingKeys = (keys: TintRequestKey[], data: Data) => {
  const { script, mode } = getDataPath();
  const currVals = data[script]?.[mode] ?? [];
  return keys.filter(k => !currVals.includes(k));
};

const addRequestKeyQueue = new ThrottledBatchQueue<TintRequestKey>({
  batchOperation: async keys => {
    const newKeys = removeExistingKeys(keys, await io.getData());
    if (newKeys.length) {
      await io.reduce(composeIdentities(...newKeys.map(getAddKeyReducer)));
    }
  },
});

//

export const haltTintRequests = () => addRequestKeyQueue.pause();

export const getCurrScriptPreloadIconKeys = async (): Promise<
  TintRequestKey[]
> => {
  const { script, mode } = getDataPath();
  return (await io.getData())[script]?.[mode] ?? [];
};

/** Requires cache instantiation */
export const getScriptNamesInFile = () =>
  Object.keys(io.getData({ useCache: true }));

export const deleteScriptNameData = (...scriptNamesToDelete: string[]) =>
  io.reduce(data => {
    const keysInData = Object.keys(data);
    const newData: Data = {};
    keysInData.forEach(
      key => !scriptNamesToDelete.includes(key) && (newData[key] = data[key]!)
    );
    return newData;
  });

export const preloadListFile$ = io.cache$;

export const throttledLogTintRequest = (
  iconKey: SFSymbolKey,
  colorHex: string
) => addRequestKeyQueue.push(getTintRequestKey(iconKey, colorHex));
