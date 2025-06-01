import { useEffect, useMemo } from 'react';

const TYPE = {
  ARRAY: 'array',
  OBJECT: 'object',
  NUMBER: 'number',
  STRING: 'string',
}


export default function GenericItem({ data, setData }) {
  const type = useMemo(() => {
    if (Array.isArray(data)) return TYPE.ARRAY;
    if (typeof data === 'object' && data !== null) return TYPE.OBJECT;
    if (typeof data === 'number') return TYPE.NUMBER;
    if (typeof data === 'string') return TYPE.STRING;
    return null;
  }, [data]);
  
  const ItemComponent = {
    [TYPE.ARRAY]: ArrayItem,
    [TYPE.OBJECT]: ObjectItem,
    [TYPE.NUMBER]: NumericItem,
    [TYPE.STRING]: StringItem,
  }[type];
  
  return ItemComponent ? <ItemComponent data={data} setData={setData} /> : null;
}


function ArrayItem({ data, setData }) {
  const handleAdd = (type) => {
    const defaults = {
      [TYPE.ARRAY]: [],
      [TYPE.OBJECT]: {},
      [TYPE.NUMBER]: 1,
      [TYPE.STRING]: '',
    };
    setData([...data, defaults[type]]);
  }
  
  return (
    <ul>
      {data?.map((item, index) => (
        <li key={index}>
          <GenericItem
            data={item}
            setData={(value) => {
              const copy = [...data];
              copy[index] = value;
              setData(copy);
            }}
          />
        </li>
      ))}
      <li>
        <select onChange={(e) => e.target.value && handleAdd(e.target.value)} defaultValue="">
          <option value="">Add an Item</option>
          {Object.values(TYPE).map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </li>
    </ul>
  );
}

function NumericItem({ data, setData }) {
  return <input type="number" value={data} onChange={(e) => setData(Number(e.target.value))} />;
}

function ObjectItem({ data, setData }) {
  const handleRenameKey = (oldKey, newKey) => {
    if (oldKey === newKey || data[newKey] !== undefined) return;
    const copy = { ...data, [newKey]: data[oldKey] };
    delete copy[oldKey];
    setData(copy);
  };

  const handleAdd = (type) => {
    const defaults = {
      [TYPE.ARRAY]: [],
      [TYPE.OBJECT]: {},
      [TYPE.NUMBER]: 1,
      [TYPE.STRING]: '',
    };
    const key = type + Object.keys(data).length;
    setData({ ...data, [key]: defaults[type] });
  };

  return (
    <ul>
      {Object.entries(data).map(([key, value]) => (
        <li key={key}>
          <input
            type="text"
            value={key}
            onChange={(e) => handleRenameKey(key, e.target.value)}
          />
          :
          <GenericItem
            data={value}
            setData={(val) => setData({ ...data, [key]: val })}
          />
        </li>
      ))}
      <li>
        <select onChange={(e) => e.target.value && handleAdd(e.target.value)} defaultValue="">
          <option value="">Add an Item</option>
          {Object.values(TYPE).map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </li>
    </ul>
  );
}

function StringItem({ data, setData }) {
  return <input type="text" value={data} onChange={(e) => setData(e.target.value)} />;
}
