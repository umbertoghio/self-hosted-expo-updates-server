import React, { useRef, useEffect } from 'react'
import { Password } from 'primereact/password'
import { InputText } from 'primereact/inputtext'
import { InputTextarea } from 'primereact/inputtextarea'
import { Calendar } from 'primereact/calendar'
import { Dropdown } from 'primereact/dropdown'
import { locale, addLocale } from 'primereact/api'
import moment from 'moment'

import { Flex, Text, Colors } from '..'

export const Input = ({
  setRef, setValue, useState, onChange, onEnter,
  autofocus, password, date, label, multiline, dropdown,
  autoComplete, error, ...props
}) => {
  const inputRef = useRef(null)
  setRef && setRef(inputRef)
  props.ref = inputRef
  useEffect(() => {
    autofocus && setTimeout(() => {
      if (!inputRef || !inputRef.current) return false
      inputRef.current.element && inputRef.current.element.focus()
      inputRef.current.inputEl && inputRef.current.inputEl.focus()
    }, 500)
  }, [autofocus])

  error && (props.className = 'invalid-input')

  if (onChange && !props.id) throw new Error('Missing ID for OnChange')

  props.value === undefined && (props.value = '')
  useState && useState.length === 2 && (props.value = useState[0])

  useState && useState.length === 2 && (props.onChange = (e) => useState[1](e.target.value))
  setValue && (props.onChange = (e) => setValue(e.target.value))
  onChange && (props.onChange = (e) => onChange({ [e.target.id]: e.target.value }))
  onEnter && (props.onKeyDown = (key) => key.keyCode === 13 && onEnter())
  useState && onChange && (props.onChange = (e) => {
    useState[1](e.target.value)
    onChange(e.target.value)
  })

  props.autoComplete = autoComplete || 'off'

  props.style = {
    borderRadius: 8,
    paddingLeft: 12,
    width: '100%',
    backgroundColor: Colors.secondary,
    border: '1px solid rgba(255,255,255,.125)',
    color: Colors.inputText,
    ...props.style
  }

  if (password) {
    props.autoComplete = 'current-password'
    props.placeholder = 'Password'
    props.feedback = false
    const containerStyle = extractStyle(props)
    props.inputStyle = { ...props.style, width: '100%' }
    props.style = containerStyle
    return <Password {...props} />
  }

  if (date) {
    props.yearRange = `2015:${moment().format('YYYY')}`
    props.showIcon = false
    props.dateFormat = 'dd/mm/yy'
    props.readOnlyInput = true
    props.inputStyle = {
      paddingLeft: 12,
      borderRadius: 20,
      border: 'none'
    }
    const containerStyle = extractStyle(props)
    props.style.width = props.style.textWidth || '50%'
    props.style.flexGrow = 1
    props.style.marginLeft = 5
    return (
      <Flex row js style={{ backgroundColor: 'rgba(30,37,47)', paddingLeft: 12, borderRadius: 20, ...containerStyle }}>
        <Text value={label} color='white' />
        <Calendar {...props} value={new Date(props.value)} />
      </Flex>
    )
  }

  if (multiline) {
    props.autoResize === undefined && (props.autoResize = true)
    props.style.height = '100%'
    props.style.padding = 15
    return <InputTextarea {...props} />
  }

  if (dropdown) return <Dropdown {...props} />

  if (label) {
    const containerStyle = extractStyle(props)
    props.style.width = props.style.textWidth || '50%'
    props.style.flexGrow = 1
    props.style.marginLeft = 5
    return (
      <Flex row js style={{ backgroundColor: 'rgba(30,37,47)', paddingLeft: 12, borderRadius: 20, ...containerStyle }}>
        <Text value={label} color='white' />
        <InputText {...props} />
      </Flex>
    )
  }

  return <InputText {...props} />
}

const extractStyle = (props) => {
  const { width, height, marginTop, marginBottom, marginLeft, marginRight, ...otherStyles } = props.style
  props.style = otherStyles
  return { width, height, marginTop, marginBottom, marginLeft, marginRight }
}

addLocale('it', {
  firstDayOfWeek: 1,
  dayNames: ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'],
  dayNamesShort: ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'],
  dayNamesMin: ['D', 'L', 'Ma', 'Me', 'G', 'V', 'S'],
  monthNames: [
    'Gennaio',
    'Febbraio',
    'Marzo',
    'Aprile',
    'Maggio',
    'Giugno',
    'Luglio',
    'Agosto',
    'Settembre',
    'Ottobre',
    'Novembre',
    'Dicembre'
  ],
  monthNamesShort: ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']
}
)
locale('it')
