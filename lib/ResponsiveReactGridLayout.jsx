// @flow
import React from "react";
import PropTypes from "prop-types";
import isEqual from "lodash.isequal";

import {
  cloneLayout,
  synchronizeLayoutWithChildren,
  validateLayout,
  noop
} from "./utils";
import {
  getBreakpointFromWidth,
  getColsFromBreakpoint,
  findOrGenerateResponsiveLayout
} from "./responsiveUtils";
import ReactGridLayout from "./ReactGridLayout";
import type { Props as RGLProps } from "./ReactGridLayout";
import type { Layout } from "./utils";

const type = obj => Object.prototype.toString.call(obj);

type State = {
  layout: Layout,
  breakpoint: string,
  cols: number,
  layouts?: { [key: string]: Layout }
};

type Props<Breakpoint: string = string> = {
  ...$Exact<RGLProps>,

  // Responsive config
  breakpoint: Breakpoint,
  breakpoints: { [key: Breakpoint]: number },
  cols: { [key: Breakpoint]: number },
  layouts: { [key: Breakpoint]: Layout },
  width: number,

  // Callbacks
  onBreakpointChange: (Breakpoint, cols: number) => void,
  onLayoutChange: (Layout, { [key: Breakpoint]: Layout }) => void,
  onWidthChange: (
    containerWidth: number,
    margin: [number, number],
    cols: number,
    containerPadding: [number, number] | null
  ) => void
};

export default class ResponsiveReactGridLayout extends React.Component<
  Props<>,
  State
> {
  // This should only include propTypes needed in this code; RGL itself
  // will do validation of the rest props passed to it.
  static propTypes = {
    //
    // Basic props
    //

    // Optional, but if you are managing width yourself you may want to set the breakpoint
    // yourself as well.
    breakpoint: PropTypes.string,

    // {name: pxVal}, e.g. {lg: 1200, md: 996, sm: 768, xs: 480}
    breakpoints: PropTypes.object,

    // # of cols. This is a breakpoint -> cols map
    cols: PropTypes.object,

    // layouts is an object mapping breakpoints to layouts.
    // e.g. {lg: Layout, md: Layout, ...}
    layouts(props: Props<>, propName: string) {
      if (type(props[propName]) !== "[object Object]") {
        throw new Error(
          "Layout property must be an object. Received: " +
            type(props[propName])
        );
      }
      Object.keys(props[propName]).forEach(key => {
        if (!(key in props.breakpoints)) {
          throw new Error(
            "Each key in layouts must align with a key in breakpoints."
          );
        }
        validateLayout(props.layouts[key], "layouts." + key);
      });
    },

    // The width of this component.
    // Required in this propTypes stanza because generateInitialState() will fail without it.
    width: PropTypes.number.isRequired,

    //
    // Callbacks
    //

    // Calls back with breakpoint and new # cols
    onBreakpointChange: PropTypes.func,

    // Callback so you can save the layout.
    // Calls back with (currentLayout, allLayouts). allLayouts are keyed by breakpoint.
    onLayoutChange: PropTypes.func,

    // Calls back with (containerWidth, margin, cols, containerPadding)
    onWidthChange: PropTypes.func
  };

  static defaultProps = {
    breakpoints: { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 },
    cols: { lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 },
    layouts: {},
    onBreakpointChange: noop,
    onLayoutChange: noop,
    onWidthChange: noop
  };

  state = this.generateInitialState();

  generateInitialState(): State {
    const {
      width,
      breakpoints,
      layouts,
      cols,
      compactType,
      verticalCompact
    } = this.props;
    const breakpoint = getBreakpointFromWidth(breakpoints, width);
    const colNo = getColsFromBreakpoint(breakpoint, cols);
    // verticalCompact compatibility, now deprecated
    const newCompactType = verticalCompact === false ? null : compactType;
    // Get the initial layout. This can tricky; we try to generate one however possible if one doesn't exist
    // for this layout.
    const initialLayout = findOrGenerateResponsiveLayout(
      layouts,
      breakpoints,
      breakpoint,
      breakpoint,
      colNo,
      newCompactType
    );

    return {
      layout: initialLayout,
      breakpoint: breakpoint,
      cols: colNo
    };
  }

  static getDerivedStateFromProps(nextProps: Props<*>, prevState: State) {
    if (!isEqual(nextProps.layouts, prevState.layouts)) {
      // Allow parent to set layouts directly.
      const { breakpoint, cols } = prevState;

      // Since we're setting an entirely new layout object, we must generate a new responsive layout
      // if one does not exist.
      const newLayout = findOrGenerateResponsiveLayout(
        nextProps.layouts,
        nextProps.breakpoints,
        breakpoint,
        breakpoint,
        cols,
        nextProps.compactType
      );
      return { layout: newLayout, layouts: nextProps.layouts };
    }

    return null;
  }

  componentDidUpdate(prevProps: Props<*>) {
    // Allow parent to set width or breakpoint directly.
    if (
      this.props.width !== prevProps.width ||
      this.props.breakpoint !== prevProps.breakpoint ||
      !isEqual(this.props.breakpoints, prevProps.breakpoints) ||
      !isEqual(this.props.cols, prevProps.cols)
    ) {
      this.onWidthChange(this.props);
    }
  }

  // wrap layouts so we do not need to pass layouts to child
  onLayoutChange = (layout: Layout) => {
    const { layouts } = this.props;
    const { breakpoint } = this.state;
    this.props.onLayoutChange(layout, {
      ...layouts,
      [breakpoint]: layout
    });
  };

  /**
   * When the width changes work through breakpoints and reset state with the new width & breakpoint.
   * Width changes are necessary to figure out the widget widths.
   */
  onWidthChange(nextProps: Props<*>) {
    const { breakpoints, cols, layouts, compactType } = nextProps;
    const {
      breakpoints: propsBreakpoints,
      cols: propCols,
      onBreakpointChange,
      onLayoutChange,
      onWidthChange
    } = this.props;
    const { breakpoint: lastBreakpoint, layout: stateLayout } = this.state;
    const newBreakpoint =
      nextProps.breakpoint ||
      getBreakpointFromWidth(nextProps.breakpoints, nextProps.width);

    const newCols: number = getColsFromBreakpoint(newBreakpoint, cols);

    // Breakpoint change
    if (
      lastBreakpoint !== newBreakpoint ||
      propsBreakpoints !== breakpoints ||
      propCols !== cols
    ) {
      // otherwise original `layouts` prop will be mutated
      const modifiedLayouts = { ...layouts };

      // Preserve the current layout if the current breakpoint is not present in the next layouts.
      if (!(lastBreakpoint in layouts))
        modifiedLayouts[lastBreakpoint] = cloneLayout(stateLayout);

      // Find or generate a new layout.
      let layout = findOrGenerateResponsiveLayout(
        modifiedLayouts,
        breakpoints,
        newBreakpoint,
        lastBreakpoint,
        newCols,
        compactType
      );

      // This adds missing items.
      layout = synchronizeLayoutWithChildren(
        layout,
        nextProps.children,
        newCols,
        compactType
      );

      // Store the new layout.
      modifiedLayouts[newBreakpoint] = layout;

      // callbacks
      onBreakpointChange(newBreakpoint, newCols);
      onLayoutChange(layout, modifiedLayouts);

      this.setState({
        breakpoint: newBreakpoint,
        layout: layout,
        cols: newCols
      });
    }
    //call onWidthChange on every change of width, not only on breakpoint changes
    onWidthChange(
      nextProps.width,
      nextProps.margin,
      newCols,
      nextProps.containerPadding
    );
  }

  render() {
    /* eslint-disable no-unused-vars */
    const {
      breakpoint,
      breakpoints,
      cols,
      layouts,
      onBreakpointChange,
      onLayoutChange,
      onWidthChange,
      ...other
    } = this.props;
    /* eslint-enable no-unused-vars */
    const { cols: stateCols, layout } = this.state;

    return (
      <ReactGridLayout
        {...other}
        onLayoutChange={this.onLayoutChange}
        layout={layout}
        cols={stateCols}
      />
    );
  }
}
