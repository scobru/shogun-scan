const TabContent = (props) => {
  return (
    <div class={`h-full ${props.active ? 'block' : 'hidden'}`}>
      {props.children}
    </div>
  );
};

export default TabContent;
