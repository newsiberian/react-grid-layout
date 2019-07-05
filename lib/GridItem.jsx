import React, { useState } from "react";
import PropTypes from "prop-types";
import { DraggableCore } from "react-draggable";
import { Resizable } from "react-resizable";
import { perc, setTopLeft, setTransform } from "./utils";
import classNames from "classnames";

/**
 * An individual item within a ReactGridLayout.
 */
export default function GridItem(props) {
  const [resizing, setResizing] = useState(null);
  const [dragging, setDragging] = useState(null);

  // Helper for generating column width
  function calcColWidth() {
    const { margin, containerPadding, containerWidth, cols } = props;
    return (
      (containerWidth - margin[0] * (cols - 1) - containerPadding[0] * 2) / cols
    );
  }

  /**
   * Return position on the page given an x, y, w, h.
   * left, top, width, height are all in pixels.
   * @param  {Number}  x             X coordinate in grid units.
   * @param  {Number}  y             Y coordinate in grid units.
   * @param  {Number}  w             W coordinate in grid units.
   * @param  {Number}  h             H coordinate in grid units.
   * @return {Object}                Object containing coords.
   */
  function calcPosition(x, y, w, h, state) {
    const { margin, containerPadding, rowHeight } = props;
    const colWidth = calcColWidth();

    const out = {
      left: Math.round((colWidth + margin[0]) * x + containerPadding[0]),
      top: Math.round((rowHeight + margin[1]) * y + containerPadding[1]),
      // 0 * Infinity === NaN, which causes problems with resize constraints;
      // Fix this if it occurs.
      // Note we do it here rather than later because Math.round(Infinity) causes deopt
      width:
        w === Infinity
          ? w
          : Math.round(colWidth * w + Math.max(0, w - 1) * margin[0]),
      height:
        h === Infinity
          ? h
          : Math.round(rowHeight * h + Math.max(0, h - 1) * margin[1])
    };

    if (state && state.resizing) {
      out.width = Math.round(state.resizing.width);
      out.height = Math.round(state.resizing.height);
    }

    if (state && state.dragging) {
      out.top = Math.round(state.dragging.top);
      out.left = Math.round(state.dragging.left);
    }

    return out;
  }

  /**
   * Translate x and y coordinates from pixels to grid units.
   * @param  {Number} top  Top position (relative to parent) in pixels.
   * @param  {Number} left Left position (relative to parent) in pixels.
   * @return {Object} x and y in grid units.
   */
  function calcXY(top, left) {
    const { margin, cols, rowHeight, w, h, maxRows } = props;
    const colWidth = calcColWidth();

    // left = colWidth * x + margin * (x + 1)
    // l = cx + m(x+1)
    // l = cx + mx + m
    // l - m = cx + mx
    // l - m = x(c + m)
    // (l - m) / (c + m) = x
    // x = (left - margin) / (coldWidth + margin)
    let x = Math.round((left - margin[0]) / (colWidth + margin[0]));
    let y = Math.round((top - margin[1]) / (rowHeight + margin[1]));

    // Capping
    x = Math.max(Math.min(x, cols - w), 0);
    y = Math.max(Math.min(y, maxRows - h), 0);

    return { x, y };
  }

  /**
   * Given a height and width in pixel values, calculate grid units.
   * @param  {Number} height Height in pixels.
   * @param  {Number} width  Width in pixels.
   * @return {Object} w, h as grid units.
   */
  function calcWH({ height, width }) {
    const { margin, maxRows, cols, rowHeight, x, y } = props;
    const colWidth = calcColWidth();

    // width = colWidth * w - (margin * (w - 1))
    // ...
    // w = (width + margin) / (colWidth + margin)
    let w = Math.round((width + margin[0]) / (colWidth + margin[0]));
    let h = Math.round((height + margin[1]) / (rowHeight + margin[1]));

    // Capping
    w = Math.max(Math.min(w, cols - x), 0);
    h = Math.max(Math.min(h, maxRows - y), 0);
    return { w, h };
  }

  /**
   * This is where we set the grid item's absolute placement. It gets a little tricky because we want to do it
   * well when server rendering, and the only way to do that properly is to use percentage width/left because
   * we don't know exactly what the browser viewport is.
   * Unfortunately, CSS Transforms, which are great for performance, break in this instance because a percentage
   * left is relative to the item itself, not its container! So we cannot use them on the server rendering pass.
   *
   * @param  {Object} pos Position object with width, height, left, top.
   * @return {Object}     Style object.
   */
  function createStyle(pos) {
    const { usePercentages, containerWidth, useCSSTransforms } = props;
    let style;
    // CSS Transforms support (default)
    if (useCSSTransforms) {
      style = setTransform(pos);
    } else {
      // top,left (slow)
      style = setTopLeft(pos);

      // This is used for server rendering.
      if (usePercentages) {
        style.left = perc(pos.left / containerWidth);
        style.width = perc(pos.width / containerWidth);
      }
    }

    return style;
  }

  /**
   * Mix a Draggable instance into a child.
   * @param  {Element} child    Child element.
   * @return {Element}          Child wrapped in Draggable.
   */
  function mixinDraggable(child) {
    return (
      <DraggableCore
        onStart={onDragHandler("onDragStart")}
        onDrag={onDragHandler("onDrag")}
        onStop={onDragHandler("onDragStop")}
        handle={props.handle}
        cancel={
          ".react-resizable-handle" + (props.cancel ? "," + props.cancel : "")
        }
      >
        {child}
      </DraggableCore>
    );
  }

  /**
   * Mix a Resizable instance into a child.
   * @param  {Element} child    Child element.
   * @param  {Object} position  Position object (pixel values)
   * @param {Object} [resizableProps] Additional props to React-Resizable
   * @return {Element}          Child wrapped in Resizable.
   */
  function mixinResizable(child, position, resizableProps) {
    const { cols, x, minW, minH, maxW, maxH } = props;
    // This is the max possible width - doesn't go to infinity because of the width of the window
    const maxWidth = calcPosition(0, 0, cols - x, 0).width;

    // Calculate min/max constraints using our min & maxes
    const mins = calcPosition(0, 0, minW, minH);
    const maxes = calcPosition(0, 0, maxW, maxH);
    const minConstraints = [mins.width, mins.height];
    const maxConstraints = [
      Math.min(maxes.width, maxWidth),
      Math.min(maxes.height, Infinity)
    ];
    return (
      <Resizable
        width={position.width}
        height={position.height}
        minConstraints={minConstraints}
        maxConstraints={maxConstraints}
        onResizeStop={onResizeHandler("onResizeStop")}
        onResizeStart={onResizeHandler("onResizeStart")}
        onResize={onResizeHandler("onResize")}
        {...resizableProps}
      >
        {child}
      </Resizable>
    );
  }

  /**
   * Wrapper around drag events to provide more useful data.
   * All drag events call the function with the given handler name,
   * with the signature (index, x, y).
   *
   * @param  {String} handlerName Handler name to wrap.
   * @return {Function}           Handler function.
   */
  function onDragHandler(handlerName) {
    return (e, { node, deltaX, deltaY }) => {
      const handler = props[handlerName];
      if (!handler) return;

      const newPosition = { top: 0, left: 0 };

      // Get new XY
      switch (handlerName) {
        case "onDragStart": {
          // Stops bubbling to allow nested grid dragging
          e.stopPropagation();

          // TODO: this wont work on nested parents
          const { offsetParent } = node;
          if (!offsetParent) return;
          const parentRect = offsetParent.getBoundingClientRect();
          const clientRect = node.getBoundingClientRect();
          newPosition.left =
            clientRect.left - parentRect.left + offsetParent.scrollLeft;
          newPosition.top =
            clientRect.top - parentRect.top + offsetParent.scrollTop;
          setDragging(newPosition);
          break;
        }
        case "onDrag":
          if (!dragging) throw new Error("onDrag called before onDragStart.");
          newPosition.left = dragging.left + deltaX;
          newPosition.top = dragging.top + deltaY;
          setDragging(newPosition);
          break;
        case "onDragStop":
          if (!dragging)
            throw new Error("onDragEnd called before onDragStart.");
          newPosition.left = dragging.left;
          newPosition.top = dragging.top;
          setDragging(null);
          break;
        default:
          throw new Error(
            "onDragHandler called with unrecognized handlerName: " + handlerName
          );
      }

      const { x, y } = calcXY(newPosition.top, newPosition.left);

      return handler.call(this, props.i, x, y, { e, node, newPosition });
    };
  }

  /**
   * Wrapper around drag events to provide more useful data.
   * All drag events call the function with the given handler name,
   * with the signature (index, x, y).
   *
   * @param  {String} handlerName Handler name to wrap.
   * @return {Function}           Handler function.
   */
  function onResizeHandler(handlerName) {
    return (e, { node, size }) => {
      const handler = props[handlerName];
      if (!handler) return;
      const { cols, x, i, maxW, minW, maxH, minH } = props;

      // Get new XY
      let { w, h } = calcWH(size);

      // Cap w at numCols
      w = Math.min(w, cols - x);
      // Ensure w is at least 1
      w = Math.max(w, 1);

      // Min/max capping
      w = Math.max(Math.min(w, maxW), minW);
      h = Math.max(Math.min(h, maxH), minH);

      setResizing(handlerName === "onResizeStop" ? null : size);

      handler.call(this, i, w, h, { e, node, size });
    };
  }

  const {
    x,
    y,
    w,
    h,
    isDraggable,
    isResizable,
    useCSSTransforms,
    resizableProps
  } = props;

  const pos = calcPosition(x, y, w, h, { dragging, resizing });
  const child = React.Children.only(props.children);

  // Create the child element. We clone the existing element but modify its className and style.
  let newChild = React.cloneElement(child, {
    className: classNames(
      "react-grid-item",
      child.props.className,
      props.className,
      {
        static: props.static,
        resizing: Boolean(resizing),
        "react-draggable": isDraggable,
        "react-draggable-dragging": Boolean(dragging),
        cssTransforms: useCSSTransforms
      }
    ),
    // We can set the width and height on the child, but unfortunately we can't set the position.
    style: {
      ...props.style,
      ...child.props.style,
      ...createStyle(pos)
    }
  });

  // Resizable support. This is usually on but the user can toggle it off.
  if (isResizable) newChild = mixinResizable(newChild, pos, resizableProps);

  // Draggable support. This is always on, except for with placeholders.
  if (isDraggable) newChild = mixinDraggable(newChild);

  return newChild;
}

GridItem.propTypes = {
  // Children must be only a single element
  children: PropTypes.element,

  // General grid attributes
  cols: PropTypes.number.isRequired,
  containerWidth: PropTypes.number.isRequired,
  rowHeight: PropTypes.number.isRequired,
  margin: PropTypes.array.isRequired,
  maxRows: PropTypes.number.isRequired,
  containerPadding: PropTypes.array.isRequired,

  // These are all in grid units
  x: PropTypes.number.isRequired,
  y: PropTypes.number.isRequired,
  w: PropTypes.number.isRequired,
  h: PropTypes.number.isRequired,

  // All optional
  minW: function(props, propName) {
    const value = props[propName];
    if (typeof value !== "number") return new Error("minWidth not Number");
    if (value > props.w || value > props.maxW)
      return new Error("minWidth larger than item width/maxWidth");
  },

  maxW: function(props, propName) {
    const value = props[propName];
    if (typeof value !== "number") return new Error("maxWidth not Number");
    if (value < props.w || value < props.minW)
      return new Error("maxWidth smaller than item width/minWidth");
  },

  minH: function(props, propName) {
    const value = props[propName];
    if (typeof value !== "number") return new Error("minHeight not Number");
    if (value > props.h || value > props.maxH)
      return new Error("minHeight larger than item height/maxHeight");
  },

  maxH: function(props, propName) {
    const value = props[propName];
    if (typeof value !== "number") return new Error("maxHeight not Number");
    if (value < props.h || value < props.minH)
      return new Error("maxHeight smaller than item height/minHeight");
  },

  // ID is nice to have for callbacks
  i: PropTypes.string.isRequired,

  // Functions
  onDragStop: PropTypes.func,
  onDragStart: PropTypes.func,
  onDrag: PropTypes.func,
  onResizeStop: PropTypes.func,
  onResizeStart: PropTypes.func,
  onResize: PropTypes.func,

  // Flags
  isDraggable: PropTypes.bool.isRequired,
  isResizable: PropTypes.bool.isRequired,
  static: PropTypes.bool,

  // Use CSS transforms instead of top/left
  useCSSTransforms: PropTypes.bool.isRequired,

  resizableProps: PropTypes.object.isRequired,

  // Others
  className: PropTypes.string,
  // Selector for draggable handle
  handle: PropTypes.string,
  // Selector for draggable cancel (see react-draggable)
  cancel: PropTypes.string
};

GridItem.defaultProps = {
  className: "",
  cancel: "",
  handle: "",
  minH: 1,
  minW: 1,
  maxH: Infinity,
  maxW: Infinity
};
