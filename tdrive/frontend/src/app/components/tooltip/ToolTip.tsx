import React, { FC, useRef, useState } from 'react';

type Position = 'top' | 'bottom' | 'left' | 'right' | 'default';

interface Props {
  children: React.ReactNode;
  tooltip: string;
  position: Position;
}

const ToolTip: FC<Props> = ({ children, tooltip, position }): JSX.Element => {
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const [showTooltip, setShowTooltip] = useState(false);

  const handleMouseEnter = ({ clientX, clientY }: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    if (!tooltipRef.current || !container.current) return;

    const { left, top } = container.current.getBoundingClientRect();

    switch (position) {
      case 'top':
        tooltipRef.current.style.left = clientX - left + 'px';
        tooltipRef.current.style.top = clientY - top + 'px';
        break;
      case 'bottom':
        tooltipRef.current.style.left = clientX - left + 'px';
        tooltipRef.current.style.top = clientY - top + container.current.clientHeight + 'px';
        break;
      case 'left':
        tooltipRef.current.style.left = clientX - left - 30 - tooltipRef.current.clientWidth + 'px';
        break;
      case 'right':
        tooltipRef.current.style.left = clientX - left + container.current.clientWidth + 'px';
        break;
      case 'default':
        tooltipRef.current.style.left = clientX - left + 'px';
        break;  
      default:
        break;
    }

    // Show the tooltip after a 0.5-second delay
    const timeoutId = setTimeout(() => {
      setShowTooltip(true);
    }, 500); 

    // Clear the timeout if the mouse leaves the element before the delay
    container.current.addEventListener('mouseleave', () => {
      clearTimeout(timeoutId);
      setShowTooltip(false);
    });
  };

  const handleMouseLeave = () => {
    setShowTooltip(false);
  };

  return (
    <div
      ref={container}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="group relative inline-block"
    >
      {children}
      {tooltip ? (
        <span
          ref={tooltipRef}
          className={`text-sm ${showTooltip ? 'visible' : 'invisible'} opacity-0 group-hover:opacity-100 group-hover:bg-zinc-600 text-white p-1 rounded absolute whitespace-nowrap ${position}`}>
          {tooltip}
        </span>
      ) : null}
    </div>
  );
};

export default ToolTip;