import React, { useState } from 'react'
import ReactDOM from 'react-dom'

import { Icon, Text, Flex, Colors } from '..'
import { useMount, useUnmount } from 'react-use'
import { motion } from 'framer-motion'

const modalMenu = document.getElementById('modal-menu')
const modalDiv = document.createElement('div')

const MENU = {
  accent: Colors.primary,
  base: 'transparent',
  background: 'rgba(17, 25, 40, 0.5)',
  miniWidth: 90,
  menuWidth: 300,
  toggle: null
}

export const HamburgerMenu = () => {
  return (
    <motion.div
      whileHover='hovered' whileTap='click' onTap={() => MENU.toggle && MENU.toggle(2)} onHoverStart={() => MENU.toggle && MENU.toggle(1)}
      variants={{ click: { rotate: '270deg' }, hovered: { rotate: '90deg' } }}
    >
      <Icon name='bars' size={30} color={Colors.primary} />
    </motion.div>
  )
}

const MenuItem = ({ item: { label, icon, path }, action }) => (
  <motion.div
    onTap={action} style={Styles.menuElement}
    whileHover='hovered' transition={{ default: { duration: 0.3 } }}
    variants={{ hovered: { x: 40 } }}
  >
    <Flex style={{ minWidth: 70, marginLeft: 10, marginRight: 20 }}>
      <Icon name={icon} size={35} />
    </Flex>
    <Text color='inherit' size={20} title value={label.toUpperCase()} />
  </motion.div>
)

export const SlidingMenu = ({ menuItems, menuAction }) => {
  const [visibility, setVisibility] = useState(0)

  useMount(() => { modalMenu.appendChild(modalDiv); MENU.toggle = setVisibility })
  useUnmount(() => { modalMenu.removeChild(modalDiv); MENU.toggle = null })

  const renderMenu = () => {
    return (
      <motion.div
        onHoverStart={() => setVisibility(2)} onHoverEnd={() => setVisibility(0)}
        animate={{
          width: [MENU.miniWidth, MENU.miniWidth, MENU.menuWidth][visibility],
          x: [-MENU.miniWidth, 0, 0][visibility],
          boxShadow: ['4px 0 78px 0px rgba(100, 100, 100, 0)', '4px 0 78px 0px rgba(100, 100, 100, 0.7)', '4px 0 58px 0px rgba(100, 100, 100, 0.7)'][visibility]
        }}
        transition={{ ease: 'easeOut', duration: 0.5 }}
        style={Styles.menuContainer}
      >
        {menuItems.map(({ path, external, ...item }, ind) => <MenuItem key={ind} item={item} action={() => { menuAction(path, external); setVisibility(0) }} />)}
      </motion.div>
    )
  }

  return ReactDOM.createPortal(renderMenu(), modalMenu)
}

const Styles = {
  menuContainer: {
    position: 'absolute',
    top: 50,
    bottom: 0,
    left: 0,
    height: '100%',
    overflow: 'hidden',
    width: MENU.miniWidth,
    x: -MENU.miniWidth,
    backdropFilter: 'blur(16px) saturate(180%)',
    WebkitBackdropFilter: 'blur(16px) saturate(180%)',
    backgroundColor: MENU.background,
    borderRight: '1px solid rgba(255, 255, 255, 0.125)'
  },
  menuElement: {
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
    backgroundColor: MENU.base,
    color: MENU.accent,
    height: 60
  }
}
