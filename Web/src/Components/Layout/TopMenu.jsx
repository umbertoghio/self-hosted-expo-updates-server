
import React from 'react'
import { motion } from 'framer-motion'
import { Text, HamburgerMenu, Flex, SlidingMenu, Colors } from '..'
import { doLogout } from '../../State'
import menuItems from './MenuItems'
import { useLocation, useNavigate } from 'react-router-dom'

export function TopMenu ({ licenses, history }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { label: currentPage } = menuItems?.find(item => pathname?.includes(item.path)) || { label: '' }

  const menuAction = (page, external) => {
    if (page === 'Logout') return doLogout()
    console.log(page, external)
    if (external) return window.open(page, '_blank')
    return navigate(page)
  }

  return (
    <>
      <SlidingMenu menuAction={menuAction} menuItems={menuItems} />
      <motion.div style={styles.containerStyle} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1 }}>
        <Flex row style={{ paddingLeft: 20 }}>
          <HamburgerMenu />
          <Text color={Colors.primary} title size='20px' style={{ marginLeft: 10 }} value={(currentPage || '').toUpperCase()} />
        </Flex>
        <Flex fh style={{ marginRight: 20 }}>
          <a href='https://ghio.io' target='_blank' rel='noreferrer' style={{ textDecoration: 'none' }}>
            <Text value='free software by GHIO.IO' size={10} color={Colors.primary} style={{ width: 64, textAlign: 'right' }} />
          </a>

        </Flex>
      </motion.div>

    </>
  )
}

const styles = {
  containerStyle: {
    width: '100%',
    height: 50,
    zIndex: 20,
    position: 'relative',
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    backdropFilter: 'blur(16px) saturate(180%)',
    backgroundColor: 'rgba(17, 25, 40, 0.5)',
    WebkitBackdropFilter: 'blur(16px) saturate(180%)',
    borderBottom: ' 1px solid rgba(255, 255, 255, 0.125)',
    y: -50,
    opacity: 0
  }
}
