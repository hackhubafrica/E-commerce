import React from 'react';
import hand_icon from '../Assets/hand_icon.png';
import arrow_icon from '../Assets/arrow.png';
import hero_image from '../Assets/hero_image.png';
import { Link } from 'react-router-dom';
import './Hero.css';
import getImageSrc from '../../utils/getImageSrc';

const Hero = () => {
  return (
    <div className='hero'>
      <div className="hero-left">
        <h2>NEW ARRIVALS ONLY</h2>
        <div className="hero-hand-icon">
          <p>new</p>
          <img src={getImageSrc(hand_icon)} alt="Hand icon" />
          
        </div>
          <p>collections</p>
          <p>for everyone</p>
        <Link className="hero-latest-btn" to="/womens">
            <span>Latest Collection</span>
            <img src={getImageSrc(arrow_icon)} alt="" />
        </Link>
      </div>
      
      <div className="hero-right">
        <img src={getImageSrc(hero_image)} alt="" />
      </div>
    </div>
  );
}

export default Hero;
