import React from 'react';
import { Link } from 'react-router-dom';
import getImageSrc from '../../utils/getImageSrc';
import './Offers.css';
import exclusive_image from '../Assets/exclusive_image.png'; 

const Offers = () => {
  return (
    <div className='offers'>
      <div className="offers-left">
        <h1>Exclusive</h1>
        <h1>Offers For You</h1> 
        <p>ONLY ON BEST SELLERS PRODUCTS</p>
        <Link className="offers-button" to="/womens">Check Now</Link>
      </div>
      <div className="offers-right">
        <img src={getImageSrc(exclusive_image)} alt="" />
      </div>
    </div>
  );
}

export default Offers;
