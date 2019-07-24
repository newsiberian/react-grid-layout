import React from "react";
import PropTypes from "prop-types";
import { Resizable as ReactResizable } from "react-resizable";

import * as propTypes from "./propTypes";

export default function Resizable({
  calcPosition,
  children,
  cols,
  x,
  minW,
  minH,
  maxW,
  maxH,
  isResizable,
  onResize,
  position,
  resizableProps,
  ...rest
}) {
  if (isResizable) {
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
      <ReactResizable
        width={position.width}
        height={position.height}
        minConstraints={minConstraints}
        maxConstraints={maxConstraints}
        onResizeStop={(e, data) => onResize(e, data, "onResizeStop")}
        onResizeStart={(e, data) => onResize(e, data, "onResizeStart")}
        onResize={(e, data) => onResize(e, data, "onResize")}
        {...resizableProps}
        {...rest}
      >
        {children}
      </ReactResizable>
    );
  }

  return children;
}

Resizable.propTypes = {
  calcPosition: PropTypes.func,
  children: PropTypes.node.isRequired,
  cols: PropTypes.number.isRequired,
  x: PropTypes.number.isRequired,
  minW: propTypes.minW,
  maxW: propTypes.maxW,
  minH: propTypes.minH,
  maxH: propTypes.maxH,
  isResizable: PropTypes.bool.isRequired,
  onResize: PropTypes.func.isRequired,
  position: PropTypes.shape({
    width: PropTypes.number,
    height: PropTypes.number
  }).isRequired,
  resizableProps: PropTypes.object.isRequired
};
