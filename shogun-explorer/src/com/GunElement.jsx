import React, { useEffect, useState } from 'react'


const GunElement = ({ node, name='data', depth = 0 }) => {
  const [data, setData] = useState(null)
  const [children, setChildren] = useState([])
  
  
  useEffect(() => {
    console.assert(node, 'node is required')
    
    if (!node) return
    
    node.get(name).on((fetchedData) => {
      setData(fetchedData)
      setChildren(
        Object.keys(fetchedData || {})
        .filter(key => typeof fetchedData[key] === 'object')
      )
    })
    
    return () => node.get(name).off()
  }, [node, name])
  
  
  return (
    <div className="pl-4 border-l-2 border-gray-300">
      {data && (
        <div>
          <strong>{name}</strong>
          <pre className="bg-gray-100 p-2 rounded-md overflow-auto text-xs">
            {JSON.stringify(data, null, 2)}
          </pre>
          {children.map((childKey) => (
            <GunElement
              key={childKey}
              node={node.get(childKey)}
              name={childKey}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default GunElement;
