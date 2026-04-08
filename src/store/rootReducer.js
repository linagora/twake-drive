import { combineReducers } from 'redux'

import { default as ui } from '@/lib/react-cozy-helpers'
import { default as rename } from '@/modules/drive/rename'
import { default as filelist } from '@/modules/filelist/duck'
import { default as view } from '@/modules/navigation/duck'
// TODO: Get rid of this, local state would be better
import { default as upload } from '@/modules/upload'

// Per Dan Abramov: https://stackoverflow.com/questions/35622588/how-to-reset-the-state-of-a-redux-store/35641992#35641992
const createRootReducer = client => {
  const baseReducers = {
    ui,
    view,
    filelist,
    upload,
    rename
  }

  const reducers = {
    ...baseReducers,
    cozy: client.reducer()
  }

  const appReducer = combineReducers(reducers)

  const rootReducer = (state, action) => {
    return appReducer(state, action)
  }

  return rootReducer
}

export default createRootReducer
