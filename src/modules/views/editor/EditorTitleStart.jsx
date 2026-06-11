import PropTypes from 'prop-types'
import React from 'react'

import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'

import BackButton from '@/components/EditorToolbar/BackButton'
import FileName from '@/components/EditorToolbar/FileName'
import HomeIcon from '@/components/EditorToolbar/HomeIcon'
import HomeLinker from '@/components/EditorToolbar/HomeLinker'
import Separator from '@/components/EditorToolbar/Separator'

/**
 * Leading cluster of the editor title bar, shared by the PDF, Excalidraw and
 * OnlyOffice editors: home link, back button, file type icon and file name.
 *
 * @param {object} props
 * @param {object} props.file - The io.cozy.files document
 * @param {React.ReactNode} [props.icon] - The file type icon (already rendered)
 * @param {boolean} [props.isPublic]
 * @param {boolean} [props.isReadOnly]
 * @param {boolean} [props.canRedirect] - Whether to show the back button
 * @param {Function} [props.onBack] - Back button handler
 */
const EditorTitleStart = ({
  file,
  icon,
  isPublic = false,
  isReadOnly = false,
  canRedirect = false,
  onBack
}) => {
  const { isMobile } = useBreakpoints()

  return (
    <div className="u-flex u-flex-items-center u-flex-grow-1 u-ellipsis">
      {!isMobile && (
        <>
          {isPublic ? (
            <HomeIcon />
          ) : (
            <HomeLinker>
              <HomeIcon />
            </HomeLinker>
          )}
          <Separator />
        </>
      )}
      {canRedirect && <BackButton onClick={onBack} />}
      {!isMobile && icon}
      <FileName file={file} isPublic={isPublic} isReadOnly={isReadOnly} />
    </div>
  )
}

EditorTitleStart.propTypes = {
  file: PropTypes.object.isRequired,
  icon: PropTypes.node,
  isPublic: PropTypes.bool,
  isReadOnly: PropTypes.bool,
  canRedirect: PropTypes.bool,
  onBack: PropTypes.func
}

export default EditorTitleStart
