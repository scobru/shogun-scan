const Tab = (props) => {
  return (
    <button
      onClick={props.onClick}
      class={props.class}
    >
      {props.label}
    </button>
  );
};

export default Tab;
