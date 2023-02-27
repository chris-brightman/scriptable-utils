import {
  Identity,
  MakeSomeReqd,
  MapFn,
  ObjComparison,
  Predicate,
  SortFn,
} from './types/utilTypes';

const RAISE_A = -1;
const RAISE_B = 1;
const NO_CHANGE = 0;

/**
 * Evaluates all sort functions in order. This means that earlier sort function
 * results may be overwritten by later ones.
 *
 * For example, in this pseudocode:
 *
 * ```
 * [...].sort(combineSortFunctions(
 *  sortByCreationDateDesc,
 *  sortByTaskState
 * ))
 * ```
 *
 * 2 items are first compared by creation date; the one created more recently
 * will be sorted to the top.
 *
 * Then, the items are compared by task state; if the result of this second
 * comparison results in no change, it will take the result from the previous
 * sort function. Else, it will overwrite the previous value.
 */
export const combineSortFunctions =
  <T>(...sortFns: SortFn<T>[]): SortFn<T> =>
  (a, b) =>
    sortFns.reduce((prevValue, sortFn) => {
      const sortFnResult = sortFn(a, b);
      return sortFnResult === NO_CHANGE ? prevValue : sortFnResult;
    }, NO_CHANGE);

type NewType<T> = Predicate<T>;

/** Generates a sorter based on the `shouldRaise` predicates passed in.
 * Predicates are evaluated in order. If no predicates match either of the
 * elements, NO_CHANGE is returned. */
export const sortByPredicates =
  <T>(...shouldRaisePreds: NewType<T>[]): SortFn<T> =>
  (a, b) => {
    for (const shouldRaise of shouldRaisePreds) {
      if (shouldRaise(a) && !shouldRaise(b)) return RAISE_A;
      if (shouldRaise(b) && !shouldRaise(a)) return RAISE_B;
    }
    return NO_CHANGE;
  };

type SortByComparisonOpts<T, CompareType> = {
  getValue: MapFn<T, CompareType>;
  shouldRaiseA: ObjComparison<CompareType>;
  /** If not provided, raising B will always be the fallback. I.e. the
   * function will never return NO_CHANGE */
  shouldRaiseB?: ObjComparison<CompareType>;
};
export const sortByComparison =
  <T, CompareType>({
    getValue,
    shouldRaiseA,
    /** If not provided, raising B will always be the fallback. I.e. the
     * function will never return NO_CHANGE */
    shouldRaiseB,
  }: SortByComparisonOpts<T, CompareType>): SortFn<T> =>
  (a, b) => {
    const aVal = getValue(a);
    const bVal = getValue(b);
    if (shouldRaiseA(aVal, bVal)) return RAISE_A;
    if (!shouldRaiseB) return RAISE_B;
    return shouldRaiseB(aVal, bVal) ? RAISE_B : NO_CHANGE;
  };

/** By default, sort ascending */
type IsDescendingOpt = { isDesc?: boolean };
type SortByTypeOpts<T, Compare> = {
  getValue?: MapFn<T, Compare>;
} & IsDescendingOpt;

type SortByType<Compare> = {
  <T extends Compare>(opts?: { getValue?: never } & IsDescendingOpt): SortFn<T>;
  <T>(opts: MakeSomeReqd<SortByTypeOpts<T, Compare>, 'getValue'>): SortFn<T>;
};

const getPrimitiveSorter =
  <Compare extends string | number | Date | null | undefined>(
    mapValue: Identity<Compare> = x => x
  ): SortByType<Compare> =>
  <T>({
    getValue = x => x as unknown as Compare,
    isDesc = false,
  }: SortByTypeOpts<T, Compare> = {}) =>
    sortByComparison({
      getValue: (entity: T) => mapValue(getValue(entity)),
      shouldRaiseA: (a, b) => (a && b ? (isDesc ? a > b : b > a) : false),
      shouldRaiseB: (a, b) => (a && b ? (isDesc ? a < b : b < a) : false),
    });

export const sortByString = getPrimitiveSorter<string | null | undefined>(str =>
  str?.toLowerCase()
);

export const sortByNumber = getPrimitiveSorter<number | null | undefined>();

export const sortByDate = getPrimitiveSorter<Date | null | undefined>();
