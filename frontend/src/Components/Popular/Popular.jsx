import React from 'react';
import './Popular.css';
import { useContext } from 'react';
import { ShopContext } from '../../Context/ShopContext';
import fallbackProducts from '../Assets/data';
import Item from '../Item/Item'; 

const Popular = () => {
  const { managedProducts } = useContext(ShopContext);
  const latestWomen = managedProducts.filter((product) => product.category === 'women').slice(0, 4);
  const popularProducts = latestWomen.length ? latestWomen : fallbackProducts;
  return (
    <div className='popular'>
      <h1>POPULAR IN WOMEN</h1>
      <hr />
      <div className="popular-item">
        {popularProducts.map(function (item) {
          return <Item 
            key={item.id}
            id={item.id} 
            name={item.name} 
            image={item.image} 
            new_price={item.new_price} 
            old_price={item.old_price} 
          />
        })}
      </div>
    </div>
  )
}

export default Popular;
