import React from "react";
import PropTypes from "prop-types";
import { DraggableCore } from "react-draggable";

/**
 * Mix a Draggable instance into a child.
 * @param  {Element} child    Child element.
 * @return {Element}          Child wrapped in Draggable.
 */
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
        onStart={onDrag("onDragStart")}
        onDrag={onDrag("onDrag")}
        onStop={onDrag("onDragStop")}
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
