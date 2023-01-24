import { ExcludeFalsy } from '../../common';
import { objectKeys } from '../../object';
import { Container, ContainerChild, ContainerStyle } from './shapes';
import { TapProps } from './types';
import { getTapProps } from './utils';

export type DivStyle = ContainerStyle & TapProps;

export type DivChild = ContainerChild | Falsy;

const Div = (children: DivChild[], opts: DivStyle = {}) => {
  const realChildren = children.filter(ExcludeFalsy);
  const el = new Container(realChildren, opts, getTapProps(opts));
  el.setDescription(`DIV > shownCells: ${realChildren.length}`);
  return el;
};
export default Div;

//
//
//

const onTapKeys: (keyof DivStyle)[] = [
  'onTap',
  'onDoubleTap',
  'onTripleTap',
  'dismissOnTap',
];

/**
 * This is for cases when you want to apply style to a Div, but don't want it to
 * cascade beyone that container. E.g. if you want margin for the Div to
 * separate it from other elements, but do not want the margin to be applied to
 * children as well.
 *
 * NB this explicitly allows onTap props to cascade, since the assumption is
 * that if an onTap is defined for a container, the implied meaning is that all
 * children have that same onTap logic. It would be possible to have e.g.
 * different onTap actions for padding vs content of a Div, for example.
 */
export const NonCascadingDiv = (children: DivChild[], opts: DivStyle = {}) =>
  Div(
    [
      Div(
        children,
        objectKeys(opts).reduce(
          (acc, key) =>
            onTapKeys.includes(key) ? acc : { ...acc, [key]: undefined },
          {} as DivStyle
        )
      ),
    ],
    opts
  );