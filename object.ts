import { filter, toReduce } from './arrayTransducers';
import { getType, objectFromEntries } from './common';

/**
 * NB: doesn't take into account order of elements in an array
 * Could be useful if inserting an existing row in table into a different position.
 */
export const isEqual = (el1: any, el2: any): boolean => {
  const el1Type = getType(el1);
  const el2Type = getType(el2);
  if (el1Type !== el2Type) return false;

  // This would probably work fine for other types, but just for date for now
  if (el1Type === 'date') return JSON.stringify(el1) === JSON.stringify(el2);

  // Simple return if not obj/array. Not dealing w/ Sets or Map
  if (!['object', 'array'].includes(el1Type)) return el1 === el2;

  // Array or obj, compare deep equality
  // Key for array = index
  const el1Keys = Object.keys(el1);
  const el2Keys = Object.keys(el2);
  if (el1Keys.length !== el2Keys.length) return false;

  return el1Keys.every(key => isEqual(el1[key], el2[key]));
};

/** Do arrays have same values, in any order? isEqual requires same order */
export const arraysHaveSameValues = (arr1: any[], arr2: any[]) => {
  if (arr1.length !== arr2.length) return false;
  return arr1.every(val => arr2.some(arr2Val => isEqual(val, arr2Val)));
};

// https://stackoverflow.com/questions/53966509/typescript-type-safe-omit-function
export const omit = <T extends AnyObj, K extends (keyof T)[]>(
  object: T,
  omitKeysArray: K
) =>
  toReduce(
    Object.entries(object),
    filter(([key]) => !omitKeysArray.includes(key as keyof T)),
    (acc, [key, val]) => ({ ...acc, [key]: val }),
    {} as { [K2 in Exclude<keyof T, K[number]>]: T[K2] }
  );

export const pick = <T extends AnyObj, K extends keyof T>(
  object: T,
  includeKeysArray: K[]
) =>
  objectFromEntries(
    objectEntries(object).filter(([key]) => includeKeysArray.includes(key as K))
  ) as unknown as Pick<T, K>;

export const uniqueArray = <T>(...arrays: T[][]) => [...new Set(arrays.flat())];

export const uniqueBy = <T, CompareVal extends PrimitiveType>(
  arr: T[],
  getCompareVal: (el: T) => CompareVal
) => {
  const { uniqueArr } = arr.reduce<{
    uniqueArr: T[];
    includedCompareVals: CompareVal[];
  }>(
    (acc, el) => {
      const compareVal = getCompareVal(el);
      const isUnique = !acc.includedCompareVals.includes(compareVal);
      if (isUnique) {
        acc.includedCompareVals.push(compareVal);
        acc.uniqueArr.push(el);
      }
      return acc;
    },
    { uniqueArr: [], includedCompareVals: [] }
  );
  return uniqueArr;
};

/** Inclusive on both start and end */
export const range = (start: number, end: number) =>
  [...new Array(end - start + 1).keys()].map(i => i + start);

export const filterJoin = (arr: any[], joinChar = '') =>
  arr.filter(Boolean).join(joinChar);

export const objectEntries = <T extends AnyObj>(
  obj: T
): { [K in keyof T]: [K, T[K]] }[keyof T][] => Object.entries(obj) as any;

export const objectKeys = <T extends Record<string, any>>(obj: T) =>
  Object.keys(obj) as (keyof T)[];

/** Given input array and mapping function, create an object from the arr. */
export const arrToObjMap = <T, O extends AnyObj>(
  arr: T[],
  arrayItemToAttr: (item: T) => [key: keyof O, value: O[keyof O]]
) => objectFromEntries(arr.map(arrayItemToAttr));

export const hasKey = <O extends AnyObj>(obj: O, key: any): key is keyof O =>
  key in obj;
