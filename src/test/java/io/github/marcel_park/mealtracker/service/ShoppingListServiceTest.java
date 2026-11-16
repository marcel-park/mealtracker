package io.github.marcel_park.mealtracker.service;

import io.github.marcel_park.mealtracker.dto.RecipeUseRequest;
import io.github.marcel_park.mealtracker.dto.ShoppingListAddRequest;
import io.github.marcel_park.mealtracker.dto.ShoppingListCountRequest;
import io.github.marcel_park.mealtracker.dto.ShoppingListUserItemRequest;
import io.github.marcel_park.mealtracker.dto.ShoppingListItemRequest;
import io.github.marcel_park.mealtracker.dto.ShoppingListItemResponse;
import io.github.marcel_park.mealtracker.dto.ShoppingListQuantityRequest;
import io.github.marcel_park.mealtracker.exception.InvalidRequestException;
import io.github.marcel_park.mealtracker.exception.NotFoundException;
import io.github.marcel_park.mealtracker.model.UserItem;
import io.github.marcel_park.mealtracker.model.Food;
import io.github.marcel_park.mealtracker.model.FoodPortion;
import io.github.marcel_park.mealtracker.model.Quantity;
import io.github.marcel_park.mealtracker.model.ShoppingListItem;
import io.github.marcel_park.mealtracker.model.User;
import io.github.marcel_park.mealtracker.repository.ShoppingListItemRepository;
import io.github.marcel_park.mealtracker.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ShoppingListServiceTest {

    @Mock
    private ShoppingListItemRepository itemRepository;

    @Mock
    private FoodService foodService;

    @Mock
    private RecipeService recipeService;

    @Mock
    private UserItemService userItemService;

    @Mock
    private UserRepository userRepository;

    @Mock
    private RecentFoodService recentFoodService;

    private ShoppingListService service;

    private static final Long USER_ID = 7L;
    private final User me = new User();
    private final Food egg = food(1L, "Ei");
    private final FoodPortion piece = portion(egg, 10L, "Stück", 60);
    private final Food milk = food(2L, "Milch");

    @BeforeEach
    void setUp() {
        me.setId(USER_ID);
        service = new ShoppingListService(itemRepository, foodService, recipeService, userItemService,
                userRepository, recentFoodService);
    }

    // ---------- test data ----------

    private static Food food(Long id, String name) {
        Food food = new Food();
        food.setId(id);
        food.setName(name);
        return food;
    }

    private static FoodPortion portion(Food food, Long id, String name, double amount) {
        FoodPortion portion = food.addPortion(name, amount, true);
        ReflectionTestUtils.setField(portion, "id", id);
        return portion;
    }

    private ShoppingListItem item(Long id, Food food, Quantity quantity, boolean checked, int position) {
        ShoppingListItem item = new ShoppingListItem(me, food, quantity, position);
        ReflectionTestUtils.setField(item, "id", id);
        item.setChecked(checked);
        return item;
    }

    private ShoppingListItem userItem(Long id, UserItem userItem, int count, boolean checked) {
        ShoppingListItem item = new ShoppingListItem(me, userItem, count, 0);
        ReflectionTestUtils.setField(item, "id", id);
        item.setChecked(checked);
        return item;
    }

    private UserItem detergent() {
        UserItem item = new UserItem(me, "Spülmittel");
        item.setId(30L);
        return item;
    }

    private static ShoppingListItemRequest grams(Long foodId, double amount) {
        return new ShoppingListItemRequest(foodId, amount, null, null);
    }

    private static ShoppingListItemRequest portions(Long foodId, Long portionId, String count) {
        return new ShoppingListItemRequest(foodId, null, portionId, new BigDecimal(count));
    }

    // ---------- add ----------

    @Nested
    class Add {

        @Test
        void newFood_isAddedAtTheEnd_inTheRequestedPortion() {
            when(foodService.getVisibleEntity(USER_ID, 1L)).thenReturn(egg);
            when(itemRepository.nextPosition(USER_ID)).thenReturn(3);
            when(itemRepository.findByUserIdAndFoodId(USER_ID, 1L)).thenReturn(Optional.empty());
            when(userRepository.getReferenceById(USER_ID)).thenReturn(me);

            service.add(USER_ID, new ShoppingListAddRequest(List.of(portions(1L, 10L, "4")), null));

            ArgumentCaptor<ShoppingListItem> captor = ArgumentCaptor.forClass(ShoppingListItem.class);
            verify(itemRepository).save(captor.capture());
            ShoppingListItem saved = captor.getValue();
            assertThat(saved.getFood()).isSameAs(egg);
            assertThat(saved.getQuantity().getPortion()).isSameAs(piece);
            assertThat(saved.getQuantity().getPortionCount()).isEqualByComparingTo("4");
            assertThat(saved.getPosition()).isEqualTo(3);
            assertThat(saved.isChecked()).isFalse();
        }

        @Test
        void foodOnTheList_addsToItInItsUnit_andStaysChecked() {
            ShoppingListItem eggs = item(5L, egg, Quantity.ofPortions(piece, new BigDecimal("3")), true, 0);
            when(foodService.getVisibleEntity(USER_ID, 1L)).thenReturn(egg);
            when(itemRepository.findByUserIdAndFoodId(USER_ID, 1L)).thenReturn(Optional.of(eggs));

            service.add(USER_ID, new ShoppingListAddRequest(List.of(grams(1L, 120)), null));

            assertThat(eggs.getQuantity().getPortionCount()).isEqualByComparingTo("5");
            assertThat(eggs.isChecked()).isTrue();
            verify(itemRepository, never()).save(any());
        }

        @Test
        void countsTheFoodsAsUsed_alsoThoseOnTheListAlready() {
            ShoppingListItem eggs = item(5L, egg, Quantity.ofPortions(piece, new BigDecimal("3")), false, 0);
            when(foodService.getVisibleEntity(USER_ID, 1L)).thenReturn(egg);
            when(foodService.getVisibleEntity(USER_ID, 2L)).thenReturn(milk);
            when(itemRepository.findByUserIdAndFoodId(USER_ID, 1L)).thenReturn(Optional.of(eggs));
            when(itemRepository.findByUserIdAndFoodId(USER_ID, 2L)).thenReturn(Optional.empty());

            service.add(USER_ID, new ShoppingListAddRequest(List.of(grams(1L, 60), grams(2L, 500)), null));

            verify(recentFoodService).record(USER_ID, Set.of(1L, 2L));
        }

        @Test
        void portionOfAnotherFood_isRejected() {
            when(foodService.getVisibleEntity(USER_ID, 2L)).thenReturn(milk);

            assertThatThrownBy(() -> service.add(USER_ID,
                    new ShoppingListAddRequest(List.of(portions(2L, 10L, "1")), null)))
                    .isInstanceOf(InvalidRequestException.class);
            verify(itemRepository, never()).save(any());
        }

        @Test
        void recipe_isRememberedAsBookedLast() {
            when(foodService.getVisibleEntity(USER_ID, 2L)).thenReturn(milk);
            when(itemRepository.findByUserIdAndFoodId(USER_ID, 2L)).thenReturn(Optional.empty());
            List<RecipeUseRequest> uses = List.of(new RecipeUseRequest(4L, 9L));

            service.add(USER_ID, new ShoppingListAddRequest(List.of(grams(2L, 500)), uses));

            verify(recipeService).markUsed(USER_ID, uses);
        }
    }

    // ---------- user items ----------

    @Nested
    class UserItems {

        @Test
        void newUserItem_isAddedAtTheEnd_withItsCount() {
            UserItem detergent = detergent();
            when(userItemService.getVisibleEntity(USER_ID, 30L)).thenReturn(detergent);
            when(itemRepository.findByUserIdAndUserItemId(USER_ID, 30L)).thenReturn(Optional.empty());
            when(itemRepository.nextPosition(USER_ID)).thenReturn(4);
            when(userRepository.getReferenceById(USER_ID)).thenReturn(me);

            service.addUserItem(USER_ID, new ShoppingListUserItemRequest(30L, 2));

            ArgumentCaptor<ShoppingListItem> captor = ArgumentCaptor.forClass(ShoppingListItem.class);
            verify(itemRepository).save(captor.capture());
            ShoppingListItem saved = captor.getValue();
            assertThat(saved.isUserItem()).isTrue();
            assertThat(saved.getUserItem()).isSameAs(detergent);
            assertThat(saved.getCount()).isEqualTo(2);
            assertThat(saved.getFood()).isNull();
            assertThat(saved.getQuantity()).isNull();
            assertThat(saved.getPosition()).isEqualTo(4);
        }

        @Test
        void userItemOnTheList_addsToItsCount_upToTheMaximum_andStaysChecked() {
            UserItem detergent = detergent();
            ShoppingListItem entry = userItem(5L, detergent, 998, true);
            when(userItemService.getVisibleEntity(USER_ID, 30L)).thenReturn(detergent);
            when(itemRepository.findByUserIdAndUserItemId(USER_ID, 30L)).thenReturn(Optional.of(entry));

            service.addUserItem(USER_ID, new ShoppingListUserItemRequest(30L, 3));

            assertThat(entry.getCount()).isEqualTo(ShoppingListCountRequest.MAX_COUNT);
            assertThat(entry.isChecked()).isTrue();
            verify(itemRepository, never()).save(any());
        }

        @Test
        void userItemOfSomebodyElse_isNotFound() {
            when(userItemService.getVisibleEntity(USER_ID, 31L))
                    .thenThrow(new NotFoundException("User item", 31L));

            assertThatThrownBy(() -> service.addUserItem(USER_ID, new ShoppingListUserItemRequest(31L, 1)))
                    .isInstanceOf(NotFoundException.class);
            verify(itemRepository, never()).save(any());
        }

        @Test
        void setCount_replacesTheCount() {
            ShoppingListItem entry = userItem(5L, detergent(), 1, false);
            when(itemRepository.findByIdAndUserId(5L, USER_ID)).thenReturn(Optional.of(entry));

            service.setCount(USER_ID, 5L, new ShoppingListCountRequest(4));

            assertThat(entry.getCount()).isEqualTo(4);
        }

        @Test
        void setCount_ofAFood_isRejected() {
            ShoppingListItem eggs = item(5L, egg, Quantity.ofAmount(120), false, 0);
            when(itemRepository.findByIdAndUserId(5L, USER_ID)).thenReturn(Optional.of(eggs));

            assertThatThrownBy(() -> service.setCount(USER_ID, 5L, new ShoppingListCountRequest(2)))
                    .isInstanceOf(InvalidRequestException.class);
        }

        @Test
        void setQuantity_ofAUserItem_isRejected() {
            ShoppingListItem entry = userItem(5L, detergent(), 1, false);
            when(itemRepository.findByIdAndUserId(5L, USER_ID)).thenReturn(Optional.of(entry));

            assertThatThrownBy(() -> service.setQuantity(USER_ID, 5L,
                    new ShoppingListQuantityRequest(100.0, null, null)))
                    .isInstanceOf(InvalidRequestException.class);
        }

        @Test
        void list_showsUserItemsWithNameAndCount_andFoodsWithTheirQuantity() {
            ShoppingListItem entry = userItem(5L, detergent(), 3, false);
            ShoppingListItem eggs = item(6L, egg, Quantity.ofAmount(120), false, 1);
            when(itemRepository.findListOf(USER_ID)).thenReturn(List.of(entry, eggs));

            List<ShoppingListItemResponse> list = service.find(USER_ID);

            assertThat(list.get(0).userItem().name()).isEqualTo("Spülmittel");
            assertThat(list.get(0).userItem().owned()).isTrue();
            assertThat(list.get(0).count()).isEqualTo(3);
            assertThat(list.get(0).food()).isNull();
            assertThat(list.get(0).amount()).isNull();
            assertThat(list.get(1).food().name()).isEqualTo("Ei");
            assertThat(list.get(1).amount()).isEqualTo(120.0);
            assertThat(list.get(1).userItem()).isNull();
            assertThat(list.get(1).count()).isNull();
        }
    }

    // ---------- check, move, remove ----------

    @Test
    void checking_movesTheItemToTheEndOfTheCheckedOnes() {
        ShoppingListItem eggs = item(5L, egg, Quantity.ofAmount(120), false, 0);
        when(itemRepository.findByIdAndUserId(5L, USER_ID)).thenReturn(Optional.of(eggs));
        when(itemRepository.nextPosition(USER_ID)).thenReturn(8);

        service.setChecked(USER_ID, 5L, true);

        assertThat(eggs.isChecked()).isTrue();
        assertThat(eggs.getPosition()).isEqualTo(8);
    }

    @Test
    void checkingAnAlreadyCheckedItem_keepsItsPlace() {
        ShoppingListItem eggs = item(5L, egg, Quantity.ofAmount(120), true, 2);
        when(itemRepository.findByIdAndUserId(5L, USER_ID)).thenReturn(Optional.of(eggs));

        service.setChecked(USER_ID, 5L, true);

        assertThat(eggs.getPosition()).isEqualTo(2);
    }

    @Test
    void move_putsTheItemAtThePlace_andTheOthersCloseUp() {
        ShoppingListItem eggs = item(5L, egg, Quantity.ofAmount(120), false, 0);
        ShoppingListItem milkItem = item(6L, milk, Quantity.ofAmount(1000), false, 4);
        ShoppingListItem bread = item(7L, food(3L, "Brot"), Quantity.ofAmount(500), false, 9);
        ShoppingListItem butter = item(8L, food(4L, "Butter"), Quantity.ofAmount(250), true, 2);
        when(itemRepository.findByIdAndUserId(7L, USER_ID)).thenReturn(Optional.of(bread));
        when(itemRepository.findListOf(USER_ID)).thenReturn(List.of(eggs, milkItem, bread, butter));

        service.move(USER_ID, 7L, 0);

        assertThat(List.of(bread, eggs, milkItem)).extracting(ShoppingListItem::getPosition).containsExactly(0, 1, 2);
        assertThat(butter.getPosition()).isEqualTo(2); // checked items keep their order
    }

    @Test
    void move_beyondTheEnd_putsTheItemLast_andBeforeTheStart_first() {
        ShoppingListItem eggs = item(5L, egg, Quantity.ofAmount(120), false, 0);
        ShoppingListItem milkItem = item(6L, milk, Quantity.ofAmount(1000), false, 1);
        when(itemRepository.findByIdAndUserId(5L, USER_ID)).thenReturn(Optional.of(eggs));
        when(itemRepository.findListOf(USER_ID)).thenReturn(List.of(eggs, milkItem));

        service.move(USER_ID, 5L, 99);
        assertThat(eggs.getPosition()).isGreaterThan(milkItem.getPosition());

        service.move(USER_ID, 5L, -3);
        assertThat(eggs.getPosition()).isLessThan(milkItem.getPosition());
    }

    @Test
    void move_ofACheckedItem_changesNothing() {
        ShoppingListItem eggs = item(5L, egg, Quantity.ofAmount(120), true, 7);
        when(itemRepository.findByIdAndUserId(5L, USER_ID)).thenReturn(Optional.of(eggs));

        service.move(USER_ID, 5L, 0);

        assertThat(eggs.getPosition()).isEqualTo(7);
    }

    @Test
    void setQuantity_replacesTheQuantity_keepingPlaceAndCheckedState() {
        ShoppingListItem eggs = item(5L, egg, Quantity.ofPortions(piece, new BigDecimal("4")), true, 3);
        when(itemRepository.findByIdAndUserId(5L, USER_ID)).thenReturn(Optional.of(eggs));

        service.setQuantity(USER_ID, 5L, new ShoppingListQuantityRequest(150.0, null, null));

        assertThat(eggs.getQuantity().isPortion()).isFalse();
        assertThat(eggs.getQuantity().getAmount()).isEqualTo(150.0);
        assertThat(eggs.isChecked()).isTrue();
        assertThat(eggs.getPosition()).isEqualTo(3);
    }

    @Test
    void setQuantity_withAPortionOfAnotherFood_isRejected() {
        ShoppingListItem milkItem = item(6L, milk, Quantity.ofAmount(1000), false, 0);
        when(itemRepository.findByIdAndUserId(6L, USER_ID)).thenReturn(Optional.of(milkItem));

        assertThatThrownBy(() -> service.setQuantity(USER_ID, 6L,
                new ShoppingListQuantityRequest(null, 10L, BigDecimal.ONE)))
                .isInstanceOf(InvalidRequestException.class);
        assertThat(milkItem.getQuantity().getAmount()).isEqualTo(1000.0);
    }

    @Test
    void itemOfAnotherUser_isReportedAsNotFound() {
        when(itemRepository.findByIdAndUserId(5L, USER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.remove(USER_ID, 5L)).isInstanceOf(NotFoundException.class);
        verify(itemRepository, never()).delete(any());
    }

    @Test
    void find_answersWithAmountPortionAndCount() {
        when(itemRepository.findListOf(USER_ID)).thenReturn(List.of(
                item(5L, egg, Quantity.ofPortions(piece, new BigDecimal("2.5")), false, 0)));

        ShoppingListItemResponse result = service.find(USER_ID).get(0);

        assertThat(result.amount()).isEqualTo(150.0);
        assertThat(result.portionId()).isEqualTo(10L);
        assertThat(result.portionCount()).isEqualByComparingTo("2.5");
        assertThat(result.food().name()).isEqualTo("Ei");
    }

    @Test
    void clear_deletesTheWholeListOfTheUser() {
        service.clear(USER_ID);

        verify(itemRepository).deleteAllOf(USER_ID);
    }
}
