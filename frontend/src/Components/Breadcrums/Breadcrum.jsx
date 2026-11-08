import React from 'react'
import './Breadcrum.css'
import arrow_icon from "../Assets/breadcrum_arrow.png"
import getImageSrc from "../../utils/getImageSrc";

const Breadcrum =(props) => {
    const {product} = props;

return (
    <div className="breadcrum">
        HOME <img src={getImageSrc(arrow_icon)} alt="" />
        SHOP <img src={getImageSrc(arrow_icon)} alt="" />
        {product.category} <img src={getImageSrc(arrow_icon)} alt="" />
        {product.name}
    </div>
    )
}

export default Breadcrum