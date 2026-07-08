import { Icon, Bottom } from '@linagora/twake-icons'
import React, { useState } from 'react'

import Accordion from 'cozy-ui/transpiled/react/Accordion'
import AccordionDetails from 'cozy-ui/transpiled/react/AccordionDetails'
import AccordionSummary from 'cozy-ui/transpiled/react/AccordionSummary'
import { makeStyles } from 'cozy-ui/transpiled/react/styles'

const useStyles = makeStyles({
  accordion: {
    boxShadow: 'none',
    border: 'none',
    backgroundColor: 'transparent',
    marginTop: '0 !important'
  },
  summary: {
    textTransform: 'none',
    color: 'var(--coolGrey)',
    minHeight: '0 !important',
    border: '0 !important'
  }
})

export const SideBarAccordion = ({
  title,
  children,
  defaultExpanded = true,
  childrenCount,
  childrenLimit = 5
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const classes = useStyles()
  const shouldShowExpand = childrenCount > childrenLimit

  const handleChange = () => {
    setIsExpanded(!isExpanded)
  }

  return (
    <Accordion
      className={classes.accordion}
      defaultExpanded={defaultExpanded}
      elevation={0}
      onChange={shouldShowExpand ? handleChange : undefined}
      expanded={!shouldShowExpand || isExpanded}
    >
      <AccordionSummary className={classes.summary} expandIcon={null}>
        {title}
        {shouldShowExpand && (
          <Icon
            className="u-mh-half"
            icon={Bottom}
            rotate={isExpanded ? 0 : -90}
          />
        )}
      </AccordionSummary>
      <AccordionDetails className="u-bdw-0">{children}</AccordionDetails>
    </Accordion>
  )
}
