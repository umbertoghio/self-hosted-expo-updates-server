import React from 'react'

export function Flex ({ style, row, children, js, jb, je, jse, flexrow, as, ae, width, height, fw, fh, bg, wrap, black, ...props }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: row ? 'row' : 'column',
        justifyContent: 'center',
        alignItems: 'center',
        ...(wrap ? { flexWrap: 'wrap' } : {}),
        ...(js ? { justifyContent: 'flex-start' } : {}),
        ...(jb ? { justifyContent: 'space-between' } : {}),
        ...(je ? { justifyContent: 'flex-end' } : {}),
        ...(jse ? { justifyContent: 'space-evenly' } : {}),
        ...(flexrow ? { flexFlow: 'row-reverse wrap' } : {}),
        ...(as ? { alignItems: 'flex-start' } : {}),
        ...(ae ? { alignItems: 'flex-end' } : {}),
        ...(fw ? { width: '100%' } : {}),
        ...(fh ? { height: '100%' } : {}),
        ...(width ? { width } : {}),
        ...(height ? { height } : {}),
        ...(black ? { backgroundColor: '#1e1e1e' } : {}),
        ...(bg ? { backgroundColor: bg === true ? 'red' : bg } : {}),
        ...style
      }}
      {...props}
    >
      {children}
    </div>
  )
}
