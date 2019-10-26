import React, { useState } from "react";
import PropTypes from "prop-types";
import classNames from "classnames";

import Draggable from "./Draggable";
import Resizable from "./Resizable";
import * as propTypes from "./propTypes";
import { perc, setTopLeft, setTransform } from "./utils";

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
    const out = {};

    // If resizing, use the exact width and height as returned from resizing callbacks.
    if (state && state.resizing) {
      out.width = Math.round(state.resizing.width);
      out.height = Math.round(state.resizing.height);
    }
    // Otherwise, calculate from grid units.
    else {
      // 0 * Infinity === NaN, which causes problems with resize constraints;
      // Fix this if it occurs.
      // Note we do it here rather than later because Math.round(Infinity) causes deopt
      out.width = w === Infinity ? w : calcWidth(w, colWidth);
      out.height = h === Infinity ? h : calcHeight(h);
    }

    if (state && state.dragging) {
      out.top = Math.round(state.dragging.top);
      out.left = Math.round(state.dragging.left);
    }
    // Otherwise, calculate from grid units.
    else {
      out.top = Math.round((rowHeight + margin[1]) * y + containerPadding[1]);
      out.left = Math.round((colWidth + margin[0]) * x + containerPadding[0]);
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
    const { margin, cols, containerPadding, rowHeight, w, h, maxRows } = props;
    const colWidth = calcColWidth();

    // left = colWidth * x + margin * (x + 1)
    // l = cx + m(x+1)
    // l = cx + mx + m
    // l - m = cx + mx
    // l - m = x(c + m)
    // (l - m) / (c + m) = x
    // x = (left - margin) / (coldWidth + margin)
    let x = Math.round((left - containerPadding[0]) / (colWidth + margin[0]));
    let y = Math.round((top - containerPadding[1]) / (rowHeight + margin[1]));

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
   * Calculate grid item width
   * @param  {Number} w        W coordinate in grid units
   * @param  {Number} colWidth Column width in pixels
   * @return {Number} Item width in pixels
   */
  function calcWidth(w, colWidth) {
    return Math.round(colWidth * w + Math.max(0, w - 1) * props.margin[0]);
  }

  /**
   * Calculate grid item height
   * @param  {Number} h H coordinate in grid units
   * @return {Number} Item height in pixels
   */
  function calcHeight(h) {
    const { rowHeight, margin } = props;
    return Math.round(rowHeight * h + Math.max(0, h - 1) * margin[1]);
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
   * Wrapper around drag events to provide more useful data.
   * All drag events call the function with the given handler name,
   * with the signature (index, x, y).
   * @param e
   * @param node
   * @param deltaX
   * @param deltaY
   * @param {String} handlerName - Handler name to wrap.
   * @return {*}
   */
  function onDragHandler(e, { node, deltaX, deltaY }, handlerName) {
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
      case "onDrag": {
        if (!dragging) throw new Error("onDrag called before onDragStart.");
        let top = dragging.top + deltaY;
        newPosition.top = dragging.top + deltaY;
        let left = dragging.left + deltaX;

        const { isBounded, w, h, containerWidth } = props;

        if (isBounded) {
          const { offsetParent } = node;

          if (offsetParent) {
            const bottomBoundary = offsetParent.clientHeight - calcHeight(h);
            if (top > bottomBoundary) top = bottomBoundary;
            if (top < 0) top = 0;

            const rightBoundary = containerWidth - calcWidth(w, calcColWidth());
            if (left > rightBoundary) left = rightBoundary;
            if (left < 0) left = 0;
          }
        }

        newPosition.left = left;
        newPosition.top = top;

        setDragging(newPosition);
        break;
      }
      case "onDragStop":
        if (!dragging) throw new Error("onDragEnd called before onDragStart.");
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
  }

  /**
   * Wrapper around drag events to provide more useful data.
   * All drag events call the function with the given handler name,
   * with the signature (index, x, y).
   * @param e
   * @param node
   * @param size
   * @param {String} handlerName - Handler name to wrap.
   */
  function onResizeHandler(e, { node, size }, handlerName) {
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
  }

  const {
    cancel,
    handle,
    cols,
    x,
    y,
    w,
    h,
    minW,
    minH,
    maxW,
    maxH,
    isDraggable,
    isResizable,
    useCSSTransforms,
    resizableProps,
    style
  } = props;

  const pos = calcPosition(x, y, w, h, { dragging, resizing });
  const child = React.Children.only(props.children);

  // Create the child element. We clone the existing element but modify its className and style.
  const newChild = React.cloneElement(child, {
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
      ...style,
      ...child.props.style,
      ...createStyle(pos)
    }
  });

  // `data-grid` isResizable can override any other props
  const resizable =
    child.props["data-grid"] &&
    typeof child.props["data-grid"].isResizable === "boolean"
      ? child.props["data-grid"].isResizable
      : isResizable;

  return (
    <Draggable
      cancel={cancel}
      handle={handle}
      isDraggable={isDraggable}
      isResizable={resizable}
      onDrag={onDragHandler}
    >
      <Resizable
        calcPosition={calcPosition}
        cols={cols}
        x={x}
        minW={minW}
        minH={minH}
        maxW={maxW}
        maxH={maxH}
        isResizable={resizable}
        onResize={onResizeHandler}
        position={pos}
        resizableProps={resizableProps}
      >
        {newChild}
      </Resizable>
    </Draggable>
  );
}

GridItem.propTypes = {
  // Children must be only a single element
  children: PropTypes.element,
  style: PropTypes.object,

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
  minW: propTypes.minW,
  maxW: propTypes.maxW,
  minH: propTypes.minH,
  maxH: propTypes.maxH,

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
  isBounded: PropTypes.bool.isRequired,
  static: PropTypes.bool,

  // Use CSS transforms instead of top/left
  useCSSTransforms: PropTypes.bool.isRequired,

  resizableProps: PropTypes.object.isRequired,

  // Others
  className: PropTypes.string,
  // Selector for draggable handle
  handle: PropTypes.string,
  // Selector for draggable cancel (see react-draggable)
  cancel: PropTypes.string,
  usePercentages: PropTypes.bool
};

GridItem.defaultProps = {
  className: "",
  cancel: "",
  handle: "",
  minH: 1,
  minW: 1,
  maxH: Infinity,
  maxW: Infinity,
  usePercentages: false
};
