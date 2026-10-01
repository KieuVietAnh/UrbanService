
import clsx from './clsx';

function Card({ children, className, as: Component = 'div', ...props }) {
  return (
    <Component className={clsx('figma-card p-4', className)} {...props}>
      {children}
    </Component>
  );
}

export default Card;
