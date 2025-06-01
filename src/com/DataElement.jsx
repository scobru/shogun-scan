import React, { useEffect, useRef, useState } from 'react'
import { useGun } from '../api/gunContext'

import style from './DataElement.module.css'

const icon = {
  string: '🔤',
  object: '🧊',
  array: '🔢',
}


export default function DataElement({ node, path, depth = 0 }) {
  const gun = useGun()
  
  const nodeRef = useRef(node || gun.get(path))
  
  const [data, setData] = useState(null)
  const [newKey, setNewKey] = useState('')
  const [newValue, setNewValue] = useState('')
  const [valueType, setValueType] = useState('string')
  
  
  useEffect(() => {
    nodeRef.current = node || gun.get(path)
    
    const updateData = (newData) => setData(newData)
    
    nodeRef.current.on(updateData)
    
    return () => nodeRef.current.off()
  }, [node, path])
  
  
  const parseValue = (value, type) => {
    if (type === 'object' || type === 'array') return {}
    return value
  }
  
  
  const addChild = () => {
    if (!newKey.trim()) return
    nodeRef.current.get(newKey.trim()).put(parseValue(newValue.trim(), valueType))
  }

  const editValue = (key) => {
    const currentType = Array.isArray(data[key]) ? 'array' : typeof data[key] === 'object' ? 'object' : 'string'
    const newType = prompt('Enter new type (string, object, array):', currentType)
    if (!newType) return

    const newValue = newType === 'string' ? prompt('Enter new value:', data[key]) : {}
    nodeRef.current.get(key).put(parseValue(newValue, newType))
  }
  
  
  const renderData = () => {
    return Object.entries(data).map(([key, value]) =>
      key !== '_' && (
        typeof value === 'object' ? <>
          <DataElement key={key} node={nodeRef.current.get(key)} path={key} depth={depth + 1} />
        </> : (
          <div key={key} onClick={()=>editValue(key)}>
            <strong>{key}:</strong> {String(value)} {icon.string}
          </div>
        )
      )
    )
  }
  
  
  return (
    <div className={style.container}>
      <h3>
        {icon[valueType]}
        {path}
      </h3>
      
      <div>
        <input
          type="text"
          placeholder="New key"
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
        />

        {valueType === 'string' && (
          <input
            type="text"
            placeholder="New value"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
          />
        )}

        <select value={valueType} onChange={(e) => setValueType(e.target.value)}>
          <option value="string">String</option>
          <option value="object">Object</option>
          <option value="array">Array</option>
        </select>

        <button onClick={addChild}>Add Child</button>
      </div>

      <div>{data ? renderData() : <div>No data at "{path}" yet.</div>}</div>
    </div>
  )
}
