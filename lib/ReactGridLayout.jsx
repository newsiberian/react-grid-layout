// @flow
import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import isEqual from "lodash.isequal";
import classNames from "classnames";
import {
  bottom,
  getChildrenKeys,
  cloneLayoutItem,
  compact,
  getLayoutItem,
  moveElement,
  synchronizeLayoutWithChildren,
  validateLayout,
  getAllCollisions,
  noop
} from "./utils";
import GridItem from "./GridItem";
import type {
  ChildrenArray as ReactChildrenArray,
  Element as ReactElement
} from "react";

// Types
import type {
  EventCallback,
  CompactType,
  GridResizeEvent,
  GridDragEvent,
  Layout,
  LayoutItem
} from "./utils";

export type Props = {
  className: string,
  style: Object,
  width: number,
  autoSize: boolean,
  cols: number,
  draggableCancel: string,
  draggableHandle: string,
  verticalCompact: boolean,
  compactType: ?("horizontal" | "vertical"),
  layout: Layout,
  margin: [number, number],
  containerPadding: [number, number] | null,
  rowHeight: number,
  maxRows: number,
  isDraggable: boolean,
  isResizable: boolean,
  isBounded: boolean,
  preventCollision: boolean,
  useCSSTransforms: boolean,
  resizableProps?: Object,

  // Callbacks
  onLayoutChange: Layout => void,
  onDrag: EventCallback,
  onDragStart: EventCallback,
  onDragStop: EventCallback,
  onResize: EventCallback,
  onResizeStart: EventCallback,
  onResizeStop: EventCallback,
  children: ReactChildrenArray<ReactElement<any>>
};
// End Types

/**
 * A reactive, fluid grid layout with draggable, resizable components.
 */

export default function ReactGridLayout({
  autoSize = true,
  children,
  className = "",
  cols = 12,
  compactType = "vertical",
  containerPadding = null,
  draggableCancel = "",
  draggableHandle = "",
  isBounded = false,
  isDraggable = true,
  isResizable = true,
  layout = [],
  margin = [10, 10],
  maxRows = Infinity,
  onDrag = noop,
  onDragStart = noop,
  onDragStop = noop,
  onLayoutChange = noop,
  onResize = noop,
  onResizeStart = noop,
  onResizeStop = noop,
  preventCollision = false,
  resizableProps = {},
  rowHeight = 150,
  style = {},
  useCSSTransforms = true,
  verticalCompact = true,
  width
}) {
  const [activeDrag, setActiveDrag] = useState(null);
  const [layoutState, setLayoutState] = useState(
    synchronizeLayoutWithChildren(
      layout,
      children,
      cols,
      // Legacy support for verticalCompact: false
      fixCompactType()
    )
  );
  const [mounted, setMounted] = useState(false);
  const [oldDragItem, setOldDragItem] = useState(null);
  const [oldLayout, setOldLayout] = useState(null);
  const [oldResizeItem, setOldResizeItem] = useState(null);
  const [childrenKeys, setChildrenKeys] = useState([]);

  useEffect(() => {
    setMounted(true);
    // Possibly call back with layout on mount. This should be done after correcting the layout width
    // to ensure we don't rerender with the wrong width.
    handleLayoutMaybeChanged(layoutState, layout);
  }, []);

  useEffect(() => {
    setNewLayout(layout);
  }, [layout, compactType]);

  useEffect(() => {
    const currentChildrenKeys = getChildrenKeys(children);
    // If children change, also regenerate the layout. Use our state
    // as the base in case because it may be more up to date than
    // what is in props.
    if (!isEqual(currentChildrenKeys, childrenKeys)) {
      setNewLayout(layout);
      setChildrenKeys(currentChildrenKeys);
    }
  });

  function setNewLayout(newLayoutBase) {
    const newLayout = synchronizeLayoutWithChildren(
      newLayoutBase,
      children,
      cols,
      fixCompactType()
    );

    setLayoutState(newLayout);
    handleLayoutMaybeChanged(newLayout, layoutState);
  }

  // componentWillReceiveProps(nextProps: Props) {
  //   const { layout } = this.state;
  //   let newLayoutBase;
  //   // Legacy support for compactType
  //   // Allow parent to set layout directly.
  //   if (
  //     !isEqual(nextProps.layout, this.props.layout) ||
  //     nextProps.compactType !== this.props.compactType
  //   ) {
  //     newLayoutBase = nextProps.layout;
  //   } else if (!childrenEqual(this.props.children, nextProps.children)) {
  //     // If children change, also regenerate the layout. Use our state
  //     // as the base in case because it may be more up to date than
  //     // what is in props.
  //     newLayoutBase = layout;
  //   }
  //
  //   // We need to regenerate the layout.
  //   if (newLayoutBase) {
  //     // allow to initialize layout before the first children will be added
  //     // this is handy for async items add, when we can't use per-item layout
  //     const newLayout = nextProps.children
  //       ? synchronizeLayoutWithChildren(
  //           newLayoutBase,
  //           nextProps.children,
  //           nextProps.cols,
  //           this.compactType(nextProps)
  //         )
  //       : newLayoutBase;
  //     this.setState({ layout: newLayout });
  //     onLayoutMaybeChanged(newLayout, layout);
  //   }
  // }

  /**
   * Calculates a pixel value for the container.
   * @return {String} Container height in pixels.
   */
  function containerHeight() {
    if (!autoSize) {
      return;
    }
    const nbRow = bottom(layoutState);
    const containerPaddingY = containerPadding
      ? containerPadding[1]
      : margin[1];
    return (
      nbRow * rowHeight + (nbRow - 1) * margin[1] + containerPaddingY * 2 + "px"
    );
  }

  function fixCompactType(): CompactType {
    return verticalCompact === false ? null : compactType;
  }

  /**
   * When dragging starts
   * @param {String} i Id of the child
   * @param {Number} x X position of the move
   * @param {Number} y Y position of the move
   * @param {Event} e The mousedown event
   * @param {Element} node The current dragging DOM element
   */
  function handleDragStart(
    i: string,
    x: number,
    y: number,
    { e, node }: GridDragEvent
  ) {
    const l = getLayoutItem(layoutState, i);

    if (!l) {
      return;
    }

    setOldDragItem(cloneLayoutItem(l));
    setOldLayout(layoutState);

    return onDragStart(layoutState, l, l, null, e, node);
  }

  /**
   * Each drag movement create a new dragelement and move the element to the dragged location
   * @param {String} i Id of the child
   * @param {Number} x X position of the move
   * @param {Number} y Y position of the move
   * @param {Event} e The mousedown event
   * @param {Element} node The current dragging DOM element
   */
  function handleDrag(
    i: string,
    x: number,
    y: number,
    { e, node }: GridDragEvent
  ) {
    const l = getLayoutItem(layoutState, i);

    if (!l) {
      return;
    }

    // Create placeholder (display only)
    const placeholder = {
      w: l.w,
      h: l.h,
      x: l.x,
      y: l.y,
      placeholder: true,
      i: i
    };

    const modifiedLayout = moveElement(
      layoutState,
      l,
      x,
      y,
      // Move the element to the dragged location.
      true,
      preventCollision,
      fixCompactType(),
      cols
    );

    onDrag(modifiedLayout, oldDragItem, l, placeholder, e, node);

    setLayoutState(compact(modifiedLayout, fixCompactType(), cols));
    setActiveDrag(placeholder);
  }

  /**
   * When dragging stops, figure out which position the element is closest to and update its x and y.
   * @param  {String} i Index of the child.
   * @param {Number} x X position of the move
   * @param {Number} y Y position of the move
   * @param {Event} e The mousedown event
   * @param {Element} node The current dragging DOM element
   */
  function handleDragStop(
    i: string,
    x: number,
    y: number,
    { e, node }: GridDragEvent
  ) {
    const l = getLayoutItem(layoutState, i);

    if (!l) {
      return;
    }

    const modifiedLayout = moveElement(
      [...layoutState],
      l,
      x,
      y,
      // Move the element here
      true,
      preventCollision,
      fixCompactType(),
      cols
    );

    onDragStop(modifiedLayout, oldDragItem, l, null, e, node);

    // Set state
    const newLayout = compact(modifiedLayout, fixCompactType(), cols);

    setActiveDrag(null);
    setLayoutState(newLayout);
    setOldDragItem(null);
    setOldLayout(null);

    handleLayoutMaybeChanged(newLayout, oldLayout);
  }

  function handleLayoutMaybeChanged(
    newLayoutState: Layout,
    oldLayoutState: ?Layout
  ) {
    const old = oldLayoutState ? oldLayoutState : layoutState;
    if (!isEqual(old, newLayoutState)) {
      onLayoutChange(newLayoutState);
    }
  }

  function handleResizeStart(
    i: string,
    w: number,
    h: number,
    { e, node }: GridResizeEvent
  ) {
    const l = getLayoutItem(layoutState, i);

    if (!l) {
      return;
    }

    setOldResizeItem(cloneLayoutItem(l));
    setOldLayout(layoutState);

    onResizeStart(layoutState, l, l, null, e, node);
  }

  function handleResize(
    i: string,
    w: number,
    h: number,
    { e, node }: GridResizeEvent
  ) {
    const l: ?LayoutItem = getLayoutItem(layoutState, i);

    if (!l) {
      return;
    }

    // Something like quad tree should be used
    // to find collisions faster
    let hasCollisions = false;

    if (preventCollision) {
      const collisions = getAllCollisions(layoutState, { ...l, w, h }).filter(
        layoutItem => layoutItem.i !== l.i
      );
      hasCollisions = collisions.length > 0;

      // If we're colliding, we need adjust the placeholder.
      if (hasCollisions) {
        // adjust w && h to maximum allowed space
        let leastX = Infinity;
        let leastY = Infinity;

        collisions.forEach(layoutItem => {
          if (layoutItem.x > l.x) {
            leastX = Math.min(leastX, layoutItem.x);
          }
          if (layoutItem.y > l.y) {
            leastY = Math.min(leastY, layoutItem.y);
          }
        });

        if (Number.isFinite(leastX)) {
          l.w = leastX - l.x;
        }
        if (Number.isFinite(leastY)) {
          l.h = leastY - l.y;
        }
      }
    }

    if (!hasCollisions) {
      // Set new width and height.
      l.w = w;
      l.h = h;
      l.persistentW = w;
      l.persistentH = h;
    }

    // Create placeholder element (display only)
    const placeholder = {
      w: l.w,
      h: l.h,
      x: l.x,
      y: l.y,
      static: true,
      i: i
    };

    onResize(layoutState, oldResizeItem, l, placeholder, e, node);

    // Re-compact the layout and set the drag placeholder.
    setLayoutState(compact(layoutState, fixCompactType(), cols));
    setActiveDrag(placeholder);
  }

  function handleResizeStop(
    i: string,
    w: number,
    h: number,
    { e, node }: GridResizeEvent
  ) {
    const l = getLayoutItem(layoutState, i);

    onResizeStop(layoutState, oldResizeItem, l, null, e, node);

    // Set state
    const newLayout = compact(layoutState, fixCompactType(), cols);

    setActiveDrag(null);
    setLayoutState(newLayout);
    setOldResizeItem(null);
    setOldLayout(null);

    handleLayoutMaybeChanged(newLayout, oldLayout);
  }

  /**
   * Create a placeholder object.
   * @return {Element} Placeholder div.
   */
  function placeholder(): ?ReactElement<any> {
    if (!activeDrag) {
      return null;
    }

    // {...this.state.activeDrag} is pretty slow, actually
    return (
      <GridItem
        w={activeDrag.w}
        h={activeDrag.h}
        x={activeDrag.x}
        y={activeDrag.y}
        i={activeDrag.i}
        className="react-grid-placeholder"
        containerWidth={width}
        cols={cols}
        margin={margin}
        containerPadding={containerPadding || margin}
        maxRows={maxRows}
        rowHeight={rowHeight}
        isDraggable={false}
        isResizable={false}
        isBounded={false}
        useCSSTransforms={useCSSTransforms}
        resizableProps={resizableProps}
      >
        <div />
      </GridItem>
    );
  }

  /**
   * Given a grid item, set its style attributes & surround in a <Draggable>.
   * @param  {Element} child React element.
   * @return {Element}       Element wrapped in draggable and properly placed.
   */
  function processGridItem(child: ReactElement<any>): ?ReactElement<any> {
    if (!child || !child.key) {
      return;
    }

    const l = getLayoutItem(layoutState, String(child.key));
    if (!l) {
      return null;
    }

    // Parse 'static'. Any properties defined directly on the grid item will take precedence.
    const draggable = Boolean(
      !l.static && isDraggable && (l.isDraggable || l.isDraggable == null)
    );
    const resizable = Boolean(
      !l.static && isResizable && (l.isResizable || l.isResizable == null)
    );

    const bounded = Boolean(
      draggable && isBounded && (l.isBounded || l.isBounded == null)
    );

    return (
      <GridItem
        containerWidth={width}
        cols={cols}
        margin={margin}
        containerPadding={containerPadding || margin}
        maxRows={maxRows}
        rowHeight={rowHeight}
        cancel={draggableCancel}
        handle={draggableHandle}
        onDragStop={handleDragStop}
        onDragStart={handleDragStart}
        onDrag={handleDrag}
        onResizeStart={handleResizeStart}
        onResize={handleResize}
        onResizeStop={handleResizeStop}
        isDraggable={draggable}
        isResizable={resizable}
        isBounded={bounded}
        useCSSTransforms={useCSSTransforms && mounted}
        usePercentages={!mounted}
        resizableProps={resizableProps}
        w={l.w}
        h={l.h}
        x={l.x}
        y={l.y}
        i={l.i}
        persistentH={l.persistentH}
        persistentW={l.persistentW}
        minH={l.minH}
        minW={l.minW}
        maxH={l.maxH}
        maxW={l.maxW}
        static={l.static}
      >
        {child}
      </GridItem>
    );
  }

  const mergedClassName = classNames("react-grid-layout", className);
  const mergedStyle = {
    height: containerHeight(),
    ...style
  };

  return (
    <div className={mergedClassName} style={mergedStyle}>
      {React.Children.map(children, child => processGridItem(child))}
      {placeholder()}
    </div>
  );
}

ReactGridLayout.displayName = "ReactGridLayout";

ReactGridLayout.propTypes = {
  //
  // Basic props
  //
  className: PropTypes.string,
  style: PropTypes.object,

  // This can be set explicitly. If it is not set, it will automatically
  // be set to the container width. Note that resizes will *not* cause this to adjust.
  // If you need that behavior, use WidthProvider.
  width: PropTypes.number,

  // If true, the container height swells and contracts to fit contents
  autoSize: PropTypes.bool,
  // # of cols.
  cols: PropTypes.number,

  // A selector that will not be draggable.
  draggableCancel: PropTypes.string,
  // A selector for the draggable handler
  draggableHandle: PropTypes.string,

  // Deprecated
  verticalCompact: function(props: Props) {
    if (
      props.verticalCompact === false &&
      process.env.NODE_ENV !== "production"
    ) {
      console.warn(
        // eslint-disable-line no-console
        "`verticalCompact` on <ReactGridLayout> is deprecated and will be removed soon. " +
          'Use `compactType`: "horizontal" | "vertical" | null.'
      );
    }
  },
  // Choose vertical or hotizontal compaction
  compactType: PropTypes.oneOf(["vertical", "horizontal"]),

  // layout is an array of object with the format:
  // {x: Number, y: Number, w: Number, h: Number, i: String}
  layout: function(props: Props) {
    const layout = props.layout;
    // I hope you're setting the data-grid property on the grid items
    if (layout === undefined) return;
    validateLayout(layout, "layout");
  },

  //
  // Grid Dimensions
  //

  // Margin between items [x, y] in px
  margin: PropTypes.arrayOf(PropTypes.number),
  // Padding inside the container [x, y] in px
  containerPadding: PropTypes.arrayOf(PropTypes.number),
  // Rows have a static height, but you can change this based on breakpoints if you like
  rowHeight: PropTypes.number,
  // Default Infinity, but you can specify a max here if you like.
  // Note that this isn't fully fleshed out and won't error if you specify a layout that
  // extends beyond the row capacity. It will, however, not allow users to drag/resize
  // an item past the barrier. They can push items beyond the barrier, though.
  // Intentionally not documented for this reason.
  maxRows: PropTypes.number,

  //
  // Flags
  //
  isDraggable: PropTypes.bool,
  isResizable: PropTypes.bool,
  isBounded: PropTypes.bool,
  // If true, grid items won't change position when being dragged over.
  preventCollision: PropTypes.bool,
  // Use CSS transforms instead of top/left
  useCSSTransforms: PropTypes.bool,
  // Additional props for React-Resizable
  resizableProps: PropTypes.object,

  //
  // Callbacks
  //

  // Callback so you can save the layout. Calls after each drag & resize stops.
  onLayoutChange: PropTypes.func,

  // Calls when drag starts. Callback is of the signature (layout, oldItem, newItem, placeholder, e, ?node).
  // All callbacks below have the same signature. 'start' and 'stop' callbacks omit the 'placeholder'.
  onDragStart: PropTypes.func,
  // Calls on each drag movement.
  onDrag: PropTypes.func,
  // Calls when drag is complete.
  onDragStop: PropTypes.func,
  //Calls when resize starts.
  onResizeStart: PropTypes.func,
  // Calls when resize movement happens.
  onResize: PropTypes.func,
  // Calls when resize is complete.
  onResizeStop: PropTypes.func,

  //
  // Other validations
  //

  // Children must not have duplicate keys.
  children: function(props: Props, propName: string) {
    const children = props[propName];

    // Check children keys for duplicates. Throw if found.
    const keys = {};
    React.Children.forEach(children, function(child) {
      if (keys[child.key]) {
        throw new Error(
          'Duplicate child key "' +
            child.key +
            '" found! This will cause problems in ReactGridLayout.'
        );
      }
      keys[child.key] = true;
    });
  }
};
