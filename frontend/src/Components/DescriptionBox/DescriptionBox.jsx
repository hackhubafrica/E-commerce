import React from "react";
import './DescriptionBox.css'

const DescriptionBox = () => {
    return(
        <div className="descriptionbox">
            <div className="descriptionbox-navigator">
                <div className="descriptionbox-nav-box"> description </div>
                <div className="descriptionbox-nav-box fade"> reviews(122) </div>
            </div>
            <div className="descriptionbox-description">
                <p>
                    Lorem ipsum dolor sit amet consectetur adipisicing elit. 
                    Ipsa unde aut, id officia nihil iusto reprehenderit exercitationem
                    non enim nobis iure cum inventore eius ullam nostrum dicta vel atque temporibus.
                </p>
                <p>
                    Lorem ipsum dolor sit amet consectetur adipisicing elit. 
                    Ipsa unde aut, id officia nihil iusto reprehenderit exercitationem
                    non enim nobis iure cum inventore eius ullam nostrum dicta vel atque temporibus.
                </p>
            </div>
        </div>
    )
}

export default DescriptionBox