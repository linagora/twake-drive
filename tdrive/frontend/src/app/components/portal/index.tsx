import { ReactNode, useEffect } from "react";
import ReactDOM from "react-dom";

const Portal = ({ children, className }: { children: ReactNode; className?: string }) => {
  const mount = document.body; // Append to <body>
  const el = document.createElement("div");

  useEffect(() => {
    if (className) {
      el.className = className;
    }
    mount.appendChild(el);

    return () => {
      mount.removeChild(el);
    }
  }, [el, mount, className]);

  return ReactDOM.createPortal(children, el);
};

export default Portal;
