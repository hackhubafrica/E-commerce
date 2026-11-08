import React from 'react';
import './NewCollections.css';
import { useContext } from 'react';
import { ShopContext } from '../../Context/ShopContext';
import fallbackCollections from '../Assets/new_collections';
import Item from '../Item/Item'; 


const  NewCollections = () => {
  const { managedProducts } = useContext(ShopContext);
  const collections = managedProducts.length ? managedProducts.slice(0, 8) : fallbackCollections;
  return (
    <div className='new-collections'>
        <h1>NEW COLLECTIONS</h1>
        <hr />
      <div className="collections">
        {collections.map((item)=>{
            return <Item key={item.id} id={item.id} name={item.name} image={item.image} new_price={item.new_price} old_price={item.old_price} />;
        })}
      </div>
    </div>
  );
}

export default NewCollections;
