package io.github.marcel_park.mealtracker.repository;

import io.github.marcel_park.mealtracker.model.ShoppingListItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.Set;

// Every query that reads or changes items filters by the user, so nobody reaches another user's
// list. The other queries only tell FoodService whether a food or portion is in use.
public interface ShoppingListItemRepository extends JpaRepository<ShoppingListItem, Long> {

    // Unchecked first, each group in its own order (see ShoppingListItem.position).
    @Query("""
            select i from ShoppingListItem i
            where i.user.id = :userId
            order by i.checked, i.position, i.id
            """)
    List<ShoppingListItem> findListOf(@Param("userId") Long userId);

    Optional<ShoppingListItem> findByIdAndUserId(Long id, Long userId);

    Optional<ShoppingListItem> findByUserIdAndFoodId(Long userId, Long foodId);

    // The next position at the end of the list, 0 for an empty one.
    @Query("select coalesce(max(i.position) + 1, 0) from ShoppingListItem i where i.user.id = :userId")
    int nextPosition(@Param("userId") Long userId);

    @Modifying
    @Query("delete from ShoppingListItem i where i.user.id = :userId")
    int deleteAllOf(@Param("userId") Long userId);

    boolean existsByFoodId(Long foodId);

    // On the list of somebody else.
    boolean existsByFoodIdAndUserIdNot(Long foodId, Long userId);

    @Query("select distinct i.food.id from ShoppingListItem i where i.food.id in :foodIds")
    Set<Long> findUsedFoodIds(@Param("foodIds") Collection<Long> foodIds);

    // The items with the portion, to turn them into amounts before it is deleted.
    // Written out: a derived findByPortionId would take Quantity.getPortionId() for an
    // attribute, which JPA does not know.
    @Query("select i from ShoppingListItem i where i.quantity.portion.id = :portionId")
    List<ShoppingListItem> findByPortionId(@Param("portionId") Long portionId);
}
