import React from 'react'
import './AddProduct.css'
import upload_area from '../../assets/upload_area.svg'
import { useState } from 'react'


const AddProduct = () => {

    const [image,setImage] = useState(false);

    const [productDetails,setProductDetails] = useState({
        name:"",
        image:"",
        category:"women",
        new_price:"",
        old_price:""
    })

    const imageHandler = (e) =>{
        setImage(e.target.files[0]);
    }

    const changeHandler = (e) =>{
        setProductDetails({...productDetails, [e.target.name]: e.target.value})
    }
     
    const Add_Product = async () => {
        console.log(productDetails);
        let responseData;
        let product = productDetails;

        let formData = new FormData();
        formData.append('product', image);

        try {
            // First, handle the image upload
            const uploadResponse = await fetch('http://localhost:4000/upload', {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                },
                body: formData,
            });

            // Check if the response is valid
            if (!uploadResponse.ok) {
                throw new Error("Image upload failed");
            }

            responseData = await uploadResponse.json();

            if (responseData.success) {
                product.image = responseData.image_url;

                // Now handle the product addition
                const addProductResponse = await fetch('http://localhost:4000/addproduct', {
                    method: 'POST',
                    headers: {
                        Accept: 'application/json',
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(product),
                });

                if (!addProductResponse.ok) {
                    throw new Error("Product addition failed");
                }

                const productData = await addProductResponse.json();
                productData.success ? alert("Product Added") : alert("Failed to add product");
            } else {
                alert("Image upload failed");
            }
        } catch (error) {
            console.error("Error occurred during product addition:", error);
            alert("Error occurred: " + error.message);
        }
        if (responseData.success) {
        setProducts((prevProducts) => [...prevProducts, product]); // Update state with new product
    }
    };


    return (
        <div className="add-product">
            <div className="addproduct-itemfield">
                <p>Product Title</p>
                <input value = {productDetails.name} onChange={changeHandler} type="text"  name='name' placeholder='Type here'/>
            </div>

            <div className="add-product-price">
                <div className="addproduct-itemfield">
                    <p>Price</p>
                    <input value = {productDetails.old_price} onChange={changeHandler} type="text"  name='old_price' placeholder='Type here'/>
                </div>
                <div className="addproduct-itemfield">
                    <p>Offer Price</p>
                    <input  value = {productDetails.new_price} onChange={changeHandler} type="text"  name='new_price' placeholder='Type here'/>
                </div>
            </div>
            <div className="addproduct-itemfield">
                    <p>Product Category</p>
                    <select value = {productDetails.category} onChange={changeHandler} name="category" className='add-product-selector'>
                        <option value="women">Women</option>
                        <option value="men">Men</option>
                        <option value="Kid">Kid</option>
                    </select>
            </div>

            <div className="addproduct-itemfield">
                <label htmlFor="file-input">
                    <img src={image?URL.createObjectURL(image): upload_area} className='addproduct-thumbnail-img' alt=''/>
                </label>
                <input onChange={imageHandler} type="file" name='image' id='file-input' hidden/>
            </div>
            <button onClick={Add_Product} className='addproduct-btn'>ADD</button>
        </div>
    )
}

export default AddProduct;