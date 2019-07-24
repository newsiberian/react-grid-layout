import React from "react";
import PropTypes from "prop-types";
import { DraggableCore } from "react-draggable";

export default function Draggable({
  cancel,
  children,
  isDraggable,
  handle,
  onDrag
}) {
  if (isDraggable) {
    return (
      <DraggableCore
        onStart={(e, data) => onDrag(e, data, "onDragStart")}
        onDrag={(e, data) => onDrag(e, data, "onDrag")}
        onStop={(e, data) => onDrag(e, data, "onDragStop")}
        handle={handle}
        cancel={`.react-resizable-handle${cancel.length ? `,${cancel}` : ""}`}
      >
        {children}
      </DraggableCore>
    );
  }

  return children;
}

Draggable.propTypes = {
  cancel: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
  isDraggable: PropTypes.bool.isRequired,
  handle: PropTypes.string.isRequired,
  onDrag: PropTypes.func.isRequired
};
