import React from 'react';
import './Item.css';
import {Link} from  'react-router-dom'
import getImageSrc from '../../utils/getImageSrc'


const Item = (props) => {
  return (
    <div className='item'>
      <Link to={`/product/${props.id}`} onClick={() => window.scrollTo(0, 0)}>
        <img src={getImageSrc(props.image)} alt={props.name} />
      </Link>
      <p>{props.name}</p>
      <div className="item-prices">
        <div className="item-price-new">
          ${props.new_price}
        </div>
        <div className="item-price-old">
          ${props.old_price}
        </div>
      </div>
    </div>
  );
};

export default Item;
