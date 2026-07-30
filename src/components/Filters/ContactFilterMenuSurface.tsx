import React, {
  forwardRef,
  type MouseEventHandler,
  type ReactElement,
  type ReactNode
} from 'react'

interface ContactFilterMenuSurfaceProps {
  children: ReactNode
  className?: string
  id: string
  onClick?: MouseEventHandler<HTMLDivElement>
}

const ContactFilterMenuSurface = forwardRef<
  HTMLDivElement,
  ContactFilterMenuSurfaceProps
>(({ children, className, id, onClick }, ref): ReactElement => {
  return (
    <div ref={ref} className={className} id={id} onClick={onClick}>
      {children}
    </div>
  )
})

ContactFilterMenuSurface.displayName = 'ContactFilterMenuSurface'

export { ContactFilterMenuSurface }
