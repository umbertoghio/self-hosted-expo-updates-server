import React from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { library } from '@fortawesome/fontawesome-svg-core'

import {
  faHome,
  faPlus,
  faSignInAlt,
  faSignOutAlt,
  faBars,
  faChevronUp,
  faUpload,
  faDownload,
  faCheck,
  faBan,
  faWrench,
  faTrash,
  faSync,
  faBook
} from '@fortawesome/free-solid-svg-icons'

library.add(
  faHome,
  faSignOutAlt,
  faPlus,
  faSignInAlt,
  faBars,
  faChevronUp,
  faUpload,
  faDownload,
  faCheck,
  faBan,
  faWrench,
  faTrash,
  faSync,
  faBook
)

export function Icon ({ name, size, style, color, ...props }) {
  return (
    <FontAwesomeIcon {...props} icon={name} style={{ fontSize: size || 36, color, ...style }} />
  )
}
